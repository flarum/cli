import fs from 'fs';
import path from 'path';
import globby from 'globby';
import chalk from 'chalk';
import traverse, { Binding, NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { BaseUpgradeStep, GitCommit, Replacement } from '../base';
import { formatCode } from '../../../../utils/ast';
import { parse } from '../../../../utils/babel-ts';
import { extensionId } from '../../../../utils/composer';

const TODO = '@TODO: register this with Extend.Admin in admin/extend instead';
const DOCS = 'https://docs.flarum.org/2.x/extend/admin';

/** A registration chain written directly in an admin initializer. */
type Registration = {
  statement: NodePath<t.ExpressionStatement>;
  calls: t.CallExpression[];
  /** What for() names, when it is a string the upgrade can read. */
  context: string | null;
  /** Why it can't move, if it can't. */
  reason: string | null;
  imports: Map<string, Binding>;
  constants: Set<Binding>;
  /** Whether its arguments use app without importing it. */
  usesGlobalApp: boolean;
};

type Edit = { start: number; end: number; text: string };

/**
 * Flarum 2.0 registers an extension's settings, permissions and page with the
 * Admin extender, in admin/extend, which is declarative and runs when the admin
 * mounts, rather than through the registry in an initializer.
 *
 * Registrations move only when they would do the same thing from there: each
 * uses nothing the initializer declares, and nothing else registers with the
 * registry as the admin boots, since registering later than that would change
 * their order. Otherwise, all of the extension's registrations stay, with a
 * @TODO saying why.
 */
export default class AdminExtender extends BaseUpgradeStep {
  type = 'Register admin settings, permissions and pages with Extend.Admin';

  protected moved: string[] = [];
  protected left: string[] = [];

  replacements(file: string): Replacement[] {
    return /^js\/src\/admin\/index\.(js|jsx|ts|tsx)$/.test(file) ? [(file, code) => this.upgrade(file, code)] : [];
  }

  targets(): string[] {
    return ['js/src/admin/index.*'];
  }

  gitCommit(): GitCommit {
    return {
      message: 'chore(2.0): register admin settings, permissions and pages with Extend.Admin',
      description: 'Flarum 2.0 registers them with the Admin extender in admin/extend.',
    };
  }

  pauseMessage(): string {
    return [
      this.moved.length > 0 && `The admin settings, permissions and pages are registered with Extend.Admin now, in ${this.moved.join(', ')}.`,
      this.left.length > 0 && `Some in ${this.left.join(', ')} were left where they are; look for the @TODO comments.`,
      chalk.underline(DOCS),
    ]
      .filter(Boolean)
      .join('\n                     ');
  }

  protected async upgrade(file: string, code: string) {
    const ast = parse(code) as t.File;
    const program = programOf(ast);
    const registrations = this.registrations(program);

    if (registrations.length === 0) return null;

    let blocked = this.otherRegistryUse(program, registrations, file);

    const target = blocked ? null : this.target(program, file);

    if (target && 'reason' in target) {
      blocked = target.reason;
    }

    if (blocked || registrations.some((registration) => registration.reason)) {
      return this.leave(file, code, registrations, blocked);
    }

    return this.move(file, code, program, registrations, target as Target);
  }

  /**
   * The registration chains written as statements of an admin initializer,
   * `app.initializers.add(name, () => { ... })`.
   */
  protected registrations(program: NodePath<t.Program>): Registration[] {
    const registrations: Registration[] = [];

    for (const statement of program.get('body')) {
      const initializer = initializerOf(statement);

      if (!initializer) continue;

      for (const inner of (initializer.get('body') as NodePath<t.BlockStatement>).get('body')) {
        if (!inner.isExpressionStatement()) continue;

        const chain = chainOf(inner.node.expression);

        if (chain) {
          registrations.push(this.registration(inner, initializer, chain));
        }
      }
    }

    return registrations;
  }

  protected registration(statement: NodePath<t.ExpressionStatement>, initializer: NodePath<t.Function>, chain: Chain): Registration {
    const registration: Registration = {
      statement,
      calls: chain.calls,
      context: null,
      reason: null,
      imports: new Map(),
      constants: new Set(),
      usesGlobalApp: false,
    };

    const because = (reason: string) => {
      registration.reason ??= reason;
    };

    const forArg = chain.root.arguments[0];

    if (chain.root.arguments.length === 1 && t.isStringLiteral(forArg)) {
      registration.context = forArg.value;
    } else if (chain.root.arguments.length === 1 && t.isIdentifier(forArg)) {
      const binding = statement.scope.getBinding(forArg.name);
      const constants = binding && staticConstants(binding);
      const init = binding?.path.isVariableDeclarator() ? binding.path.node.init : null;

      if (constants && t.isStringLiteral(init)) {
        registration.context = init.value;
      }
    }

    if (registration.context === null) {
      because('for() is not given a string the upgrade can read');
    }

    for (const call of chain.calls) {
      const method = (call.callee as t.MemberExpression).property as t.Identifier;
      const arity = ARITY[method.name];

      if (!arity) {
        because(`it calls ${method.name}(), which Extend.Admin has no equivalent of`);
      } else if (call.arguments.length < arity[0] || call.arguments.length > arity[1] || call.arguments.some((arg) => !t.isExpression(arg))) {
        because(`its ${method.name}() is not given the arguments the upgrade expects`);
      }
    }

    const inRoot = (p: NodePath) => Boolean(p.findParent((parent) => parent.node === chain.root));
    const appParam = initializer.node.params[0];
    // Babel's scope has no bindings for these.
    const types = typeDeclarations(statement.scope.getProgramParent().path.node as t.Program);

    const reference = (p: NodePath<t.Identifier | t.JSXIdentifier>) => {
      if (!p.isReferencedIdentifier() || inRoot(p)) return;

      const name = p.node.name;
      const binding = p.scope.getBinding(name);

      if (!binding) {
        if (types.has(name)) {
          because(`it uses ${name}, which this file declares`);

          return;
        }

        if (
          name === 'arguments' &&
          !p.findParent((parent) => parent.isFunction() && !parent.isArrowFunctionExpression() && parent.isDescendant(statement))
        ) {
          because("it uses arguments, which are the initializer's");
        }

        if (name === 'app') registration.usesGlobalApp = true;

        return;
      }

      if (binding.path.isDescendant(statement)) return;

      if ((binding.kind as string) === 'param' && binding.path.node === appParam && name === 'app') {
        registration.usesGlobalApp = true;

        return;
      }

      if (isImport(binding)) {
        registration.imports.set(name, binding);

        return;
      }

      const constants = binding.scope.path.isProgram() ? staticConstants(binding) : null;

      if (constants) {
        constants.forEach((constant) => registration.constants.add(constant));

        return;
      }

      because(`it uses ${name}, which this ${binding.path.isDescendant(initializer) ? 'initializer' : 'file'} declares`);
    };

    statement.traverse({
      ThisExpression(p) {
        if (!p.findParent((parent) => parent.isFunction() && !parent.isArrowFunctionExpression() && parent.isDescendant(statement))) {
          because("it uses this, which is the initializer's");
        }
      },
      Identifier: (p) => reference(p),
      JSXIdentifier: (p) => reference(p),
    });

    // Imports the constants' values use go along with them.
    for (const constant of registration.constants) {
      (constant.path as NodePath).traverse({
        Identifier(p) {
          if (!p.isReferencedIdentifier()) return;

          const binding = p.scope.getBinding(p.node.name);

          if (binding && isImport(binding)) registration.imports.set(binding.identifier.name, binding);
        },
      });
    }

    return registration;
  }

  /**
   * Why nothing can move because of other code using the registry: in another
   * admin file, or in this one other than in a registration chain or in a
   * function that runs later, through extend() or override().
   */
  protected otherRegistryUse(program: NodePath<t.Program>, registrations: Registration[], file: string): string | null {
    const others = globby
      .sync('js/src/admin/**/*.{js,jsx,ts,tsx}', { cwd: this.root })
      .filter((other) => other !== file)
      .sort()
      .find((other) => REGISTRY.test(fs.readFileSync(path.join(this.root, other), 'utf8')));

    if (others) return `${others} uses the registry too`;

    const statements = new Set<t.Node>(registrations.map((registration) => registration.statement.node));
    let reason: string | null = null;

    program.traverse({
      MemberExpression(p) {
        if (reason || !isRegistry(p.node)) return;

        const inRegistration = p.findParent((parent) => statements.has(parent.node));
        const runsLater = p.findParent((parent) => parent.isFunction() && isLaterCallback(parent));

        if (!inRegistration && !runsLater) {
          reason = 'other code in this file uses the registry as it runs';
        }
      },
    });

    return reason;
  }

  /**
   * Where the extender goes: the admin/extend the index exports, or a new one.
   */
  protected target(program: NodePath<t.Program>, file: string): Target | { reason: string } {
    const lang = path.extname(file).slice(1);
    const dir = path.posix.dirname(file);
    const existing = ['ts', 'tsx', 'js', 'jsx']
      .map((ext) => `${dir}/extend.${ext}`)
      .find((candidate) => fs.existsSync(path.join(this.root, candidate)));

    const exported = program.node.body.filter(
      (node) =>
        (t.isExportNamedDeclaration(node) &&
          (node.specifiers.some((specifier) => t.isExportSpecifier(specifier) && exportedName(specifier) === 'extend') ||
            (t.isVariableDeclaration(node.declaration) && node.declaration.declarations.some((d) => t.isIdentifier(d.id, { name: 'extend' }))) ||
            (t.isFunctionDeclaration(node.declaration) && node.declaration.id?.name === 'extend'))) ||
        t.isExportAllDeclaration(node)
    );

    const reexport = exported.find(
      (node): node is t.ExportNamedDeclaration => t.isExportNamedDeclaration(node) && node.source !== null && node.source !== undefined
    );

    if (exported.some((node) => !t.isExportAllDeclaration(node) && node !== reexport)) {
      return { reason: 'the index exports its extenders itself' };
    }

    if (!reexport) {
      if (existing) {
        return { reason: `${existing} exists, but the index does not export it` };
      }

      return { file: `${dir}/extend.${lang}`, existing: null, common: null };
    }

    const source = reexport.source!.value;
    const specifier = reexport.specifiers.find((s) => t.isExportSpecifier(s) && exportedName(s) === 'extend') as t.ExportSpecifier;

    if (!t.isIdentifier(specifier.local, { name: 'default' })) {
      return { reason: 'the index exports something other than a default export as extend' };
    }

    if (source.startsWith('./')) {
      const resolved = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']
        .map((suffix) => path.posix.join(dir, source + suffix))
        .find((candidate) => fs.existsSync(path.join(this.root, candidate)) && fs.statSync(path.join(this.root, candidate)).isFile());

      if (!resolved) {
        return { reason: `the index exports extend from ${source}, which the upgrade could not find` };
      }

      return { file: resolved, existing: fs.readFileSync(path.join(this.root, resolved), 'utf8'), common: null };
    }

    if (existing) {
      return { reason: `${existing} exists, but the index exports ${source} instead` };
    }

    if (reexport.specifiers.length > 1) {
      return { reason: `the index exports more than extend from ${source}` };
    }

    return { file: `${dir}/extend.${lang}`, existing: null, common: { source, declaration: reexport } };
  }

  protected leave(file: string, code: string, registrations: Registration[], blocked: string | null) {
    const edits: Edit[] = [];

    for (const registration of registrations) {
      const node = registration.statement.node;

      if (node.leadingComments?.some((comment) => comment.value.includes(TODO))) continue;

      const reason = registration.reason ?? blocked ?? 'another registration in this file cannot move, and moving only some would change their order';
      const lineStart = code.lastIndexOf('\n', node.start! - 1) + 1;
      const indent = code.slice(lineStart, node.start!);

      edits.push({ start: lineStart, end: lineStart, text: `${indent}// ${TODO} (${DOCS}). The upgrade left it here because ${reason}.\n` });
    }

    if (edits.length === 0) return null;

    this.left.push(file);

    return { updated: applyEdits(code, edits) };
  }

  protected async move(file: string, code: string, program: NodePath<t.Program>, registrations: Registration[], target: Target) {
    const id = this.extensionId();

    const existing = target.existing === null ? null : parseExtend(target.existing);

    if (existing && 'reason' in existing) {
      return this.leave(file, code, registrations, `${target.file} ${existing.reason}`);
    }

    // What the extend file needs from the index.
    const imports = new Map<string, Binding>();
    const constants = new Set<Binding>();
    let usesGlobalApp = false;

    for (const registration of registrations) {
      registration.imports.forEach((binding, name) => imports.set(name, binding));
      registration.constants.forEach((constant) => constants.add(constant));
      usesGlobalApp ||= registration.usesGlobalApp && !registration.imports.has('app');
    }

    const needed: Needed[] = [defaultImport('Extend', 'flarum/common/extenders')];

    if (target.common) {
      needed.push(defaultImport('commonExtend', target.common.source));
    }

    if (usesGlobalApp && !imports.has('app')) {
      needed.push(defaultImport('app', 'flarum/admin/app'));
    }

    needed.push(...importsNeeded(imports));

    const constantDeclarations = [...constants].sort((a, b) => a.path.node.start! - b.path.node.start!);

    for (const constant of constantDeclarations) {
      const declarator = constant.path.node as t.VariableDeclarator;

      needed.push({ name: constant.identifier.name, text: `const ${slice(code, declarator)};`, kind: 'const' });
    }

    // Each name once, and not one the extend file uses for something else.
    const missing: Needed[] = [];

    for (const need of needed) {
      const twin = needed.find((other) => other !== need && other.name === need.name);

      if (twin && !sameBinding(twin, need)) {
        return this.leave(file, code, registrations, `admin/extend would need two different things named ${need.name}`);
      }

      const has = existing?.bindings.get(need.name);

      if (has && !sameBinding(has, need)) {
        return this.leave(file, code, registrations, `${target.file} already uses the name ${need.name}`);
      }

      if (!has && !missing.some((other) => other.name === need.name)) {
        missing.push(need);
      }
    }

    const importLines = printImports(missing, code);
    const constantLines = missing.filter((need): need is Constant => need.kind === 'const').map((need) => need.text);

    // The extenders, one for each extension named, in the order they appear.
    const contexts: string[] = [];

    for (const registration of registrations) {
      if (!contexts.includes(registration.context!)) contexts.push(registration.context!);
    }

    const extenders = contexts.map((context) => {
      const args = context === id ? '' : `'${context.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

      return (
        `new Extend.Admin(${args})` +
        registrations
          .filter((registration) => registration.context === context)
          .map((registration) => methods(registration, code))
          .join('')
      );
    });

    const extendCode = existing
      ? appendTo(target.existing!, existing, importLines, constantLines, extenders)
      : newExtend(importLines, constantLines, extenders, Boolean(target.common));

    const index = indexEdits(code, program, registrations, imports, constants, target);

    this.moved.push(target.file);

    return {
      updated: index,
      newFiles: [{ path: target.file, code: await formatCode(extendCode) }],
    };
  }

  /** The extension's ID, as core makes it from the package name. */
  protected extensionId(): string | null {
    try {
      return extensionId(JSON.parse(fs.readFileSync(path.join(this.root, 'composer.json'), 'utf8')).name);
    } catch {
      return null;
    }
  }
}

type Chain = { root: t.CallExpression; calls: t.CallExpression[] };

type Target = {
  file: string;
  /** The code of the extend file the index exports, if it already exists. */
  existing: string | null;
  /** The extenders outside admin the index exported, which the new file spreads. */
  common: { source: string; declaration: t.ExportNamedDeclaration } | null;
};

type Import = {
  name: string;
  kind: 'import';
  source: string;
  imported: string;
  typeOnly: boolean;
  /** The whole import, for one the upgrade writes itself. */
  text?: string;
  /** Or the index's import it comes from. */
  declaration?: t.ImportDeclaration;
  specifier?: t.ImportDeclaration['specifiers'][number];
};

type Constant = { name: string; text: string; kind: 'const' };

type Needed = Import | Constant;

type Existing = {
  ast: t.File;
  array: t.ArrayExpression;
  bindings: Map<string, Needed>;
  lastImportEnd: number | null;
};

/** The arguments each registry method takes, at least and at most. */
const ARITY: Record<string, [number, number]> = {
  registerSetting: [1, 2],
  registerPermission: [2, 3],
  registerPage: [1, 1],
};

const REGISTRY = /\bapp\.(extensionData|registry)\b/;

function programOf(ast: t.File): NodePath<t.Program> {
  let program: NodePath<t.Program> | null = null;

  traverse(ast, {
    Program(p) {
      program = p;
      p.stop();
    },
  });

  return program!;
}

const slice = (code: string, node: t.Node) => code.slice(node.start!, node.end!);

const isApp = (node: t.Node) => t.isIdentifier(node, { name: 'app' });

function isRegistry(node: t.MemberExpression): boolean {
  return isApp(node.object) && !node.computed && t.isIdentifier(node.property) && ['extensionData', 'registry'].includes(node.property.name);
}

/** The callback of `app.initializers.add(name, callback)`, when it has a body. */
function initializerOf(statement: NodePath): NodePath<t.Function> | null {
  if (!statement.isExpressionStatement()) return null;

  const call = statement.get('expression');

  if (!call.isCallExpression()) return null;

  const callee = call.node.callee;

  if (
    !t.isMemberExpression(callee) ||
    !t.isIdentifier(callee.property, { name: 'add' }) ||
    !t.isMemberExpression(callee.object) ||
    !isApp(callee.object.object) ||
    !t.isIdentifier(callee.object.property, { name: 'initializers' })
  ) {
    return null;
  }

  const callback = call.get('arguments')[1];

  if (!callback || !(callback.isArrowFunctionExpression() || callback.isFunctionExpression()) || !t.isBlockStatement(callback.node.body)) {
    return null;
  }

  return callback as NodePath<t.Function>;
}

/** `app.extensionData.for(...).registerX(...)...`, or app.registry's. */
function chainOf(expression: t.Expression): Chain | null {
  const calls: t.CallExpression[] = [];
  let node: t.Node = expression;

  while (t.isCallExpression(node) && t.isMemberExpression(node.callee) && !node.callee.computed && t.isIdentifier(node.callee.property)) {
    const object: t.Node = node.callee.object;

    if (node.callee.property.name === 'for' && t.isMemberExpression(object) && isRegistry(object)) {
      return calls.length > 0 ? { root: node, calls: calls.reverse() } : null;
    }

    calls.push(node);
    node = object;
  }

  return null;
}

/** The names of the types, interfaces, enums and namespaces a file declares. */
function typeDeclarations(program: t.Program): Set<string> {
  const names = new Set<string>();

  for (const node of program.body) {
    const declaration = t.isExportNamedDeclaration(node) ? node.declaration : node;

    if (
      (t.isTSInterfaceDeclaration(declaration) ||
        t.isTSTypeAliasDeclaration(declaration) ||
        t.isTSEnumDeclaration(declaration) ||
        t.isTSModuleDeclaration(declaration)) &&
      t.isIdentifier(declaration.id)
    ) {
      names.add(declaration.id.name);
    }
  }

  return names;
}

function isImport(binding: Binding): boolean {
  return binding.path.isImportSpecifier() || binding.path.isImportDefaultSpecifier() || binding.path.isImportNamespaceSpecifier();
}

/**
 * A module-level constant whose value is fixed, with the constants its value
 * uses: those can be copied as they are.
 */
function staticConstants(binding: Binding, seen = new Set<Binding>()): Set<Binding> | null {
  if (seen.has(binding)) return seen;

  if (binding.kind !== 'const' || !binding.path.isVariableDeclarator() || !binding.scope.path.isProgram() || !binding.path.node.init) {
    return null;
  }

  seen.add(binding);

  const init = binding.path.get('init') as NodePath<t.Expression>;

  return isStatic(init, seen) ? seen : null;
}

function isStatic(p: NodePath, seen: Set<Binding>): boolean {
  const node = p.node;

  if (t.isStringLiteral(node) || t.isNumericLiteral(node) || t.isBooleanLiteral(node) || t.isNullLiteral(node)) return true;

  if (t.isTemplateLiteral(node)) return (p.get('expressions') as NodePath[]).every((expression) => isStatic(expression, seen));

  if (t.isBinaryExpression(node)) return isStatic(p.get('left') as NodePath, seen) && isStatic(p.get('right') as NodePath, seen);

  if (t.isUnaryExpression(node)) return isStatic(p.get('argument') as NodePath, seen);

  if (t.isTSAsExpression(node) || t.isParenthesizedExpression(node)) return isStatic(p.get('expression') as NodePath, seen);

  if (t.isIdentifier(node)) {
    const binding = p.scope.getBinding(node.name);

    return Boolean(binding && staticConstants(binding, seen));
  }

  return false;
}

/** A function given to extend() or override(), which runs when the extended method does. */
function isLaterCallback(fn: NodePath): boolean {
  const call = fn.parentPath;

  if (!call?.isCallExpression() || fn.listKey !== 'arguments' || !t.isIdentifier(call.node.callee)) return false;

  const binding = call.scope.getBinding(call.node.callee.name);

  if (!binding || !binding.path.isImportSpecifier()) return false;

  const declaration = binding.path.parent as t.ImportDeclaration;
  const imported = binding.path.node.imported;
  const importedName = t.isIdentifier(imported) ? imported.name : imported.value;

  return /(^|\/)extend$/.test(declaration.source.value) && ['extend', 'override'].includes(importedName);
}

const exportedName = (specifier: t.ExportSpecifier) => (t.isIdentifier(specifier.exported) ? specifier.exported.name : specifier.exported.value);

/** The extender methods for a registration's calls, with the comments among them. */
function methods(registration: Registration, code: string): string {
  const node = registration.statement.node;
  const parent = registration.statement.parentPath.node as t.BlockStatement;
  const previous = parent.body[parent.body.indexOf(node) - 1];

  // Comments above the statement, but not one ending the line before it.
  const leading = (node.leadingComments ?? []).filter((comment) => !previous || comment.loc!.start.line > previous.loc!.end.line);
  const argRanges = registration.calls.flatMap((call) => call.arguments.map((arg) => [arg.start!, arg.end!]));
  const inArgs = (comment: t.Comment) => argRanges.some(([start, end]) => comment.start! >= start && comment.end! <= end);
  let text = '';

  registration.calls.forEach((call, i) => {
    const start = i === 0 ? node.start! : registration.calls[i - 1].end!;
    const comments = [...(i === 0 ? leading : []), ...commentsIn(start, call.end!, node).filter((comment) => !inArgs(comment))];

    text += comments.map((comment) => '\n' + printComment(comment)).join('') + '\n';
    text += method(call, code);
  });

  // Ones after the last call, before the semicolon.
  const last = registration.calls[registration.calls.length - 1];

  for (const comment of commentsIn(last.end!, node.end!, node)) {
    text += ' ' + printComment(comment) + (comment.type === 'CommentLine' ? '\n' : '');
  }

  return text;
}

const printComment = (comment: t.Comment) => (comment.type === 'CommentLine' ? `//${comment.value}` : `/*${comment.value}*/`);

/** The comments the statement's own source has between two offsets. */
function commentsIn(start: number, end: number, statement: t.ExpressionStatement): t.Comment[] {
  const all: t.Comment[] = [];

  t.traverseFast(statement, (node) => {
    for (const comment of [...(node.leadingComments ?? []), ...(node.innerComments ?? []), ...(node.trailingComments ?? [])]) {
      if (comment.start! >= start && comment.end! <= end && !all.some((c) => c.start === comment.start)) all.push(comment);
    }
  });

  return all.sort((a, b) => a.start! - b.start!);
}

function method(call: t.CallExpression, code: string): string {
  const name = ((call.callee as t.MemberExpression).property as t.Identifier).name;
  const [first, ...rest] = call.arguments.map((arg) => slice(code, arg));
  const more = rest.map((arg) => `, ${arg}`).join('');

  switch (name) {
    case 'registerSetting':
      return t.isFunction(call.arguments[0]) ? `.customSetting(${first}${more})` : `.setting(() => (${first})${more})`;
    case 'registerPermission':
      return `.permission(() => (${first})${more})`;
    default:
      return `.page(${first})`;
  }
}

/** What the extend file needs from the index's imports, in the index's order. */
function importsNeeded(imports: Map<string, Binding>): Import[] {
  return [...imports.values()]
    .sort((a, b) => a.path.node.start! - b.path.node.start!)
    .map((binding) => {
      const declaration = binding.path.parent as t.ImportDeclaration;
      const specifier = binding.path.node as t.ImportDeclaration['specifiers'][number];

      return {
        name: specifier.local.name,
        kind: 'import',
        source: declaration.source.value,
        imported: importedOf(specifier),
        typeOnly: isTypeOnly(declaration, specifier),
        declaration,
        specifier,
      };
    });
}

function defaultImport(name: string, source: string): Import {
  return { name, kind: 'import', source, imported: 'default', typeOnly: false, text: `import ${name} from '${source}';` };
}

const isTypeOnly = (declaration: t.ImportDeclaration, specifier: t.ImportDeclaration['specifiers'][number]) =>
  declaration.importKind === 'type' || (t.isImportSpecifier(specifier) && specifier.importKind === 'type');

/** The import lines for what is missing: the index's imports keep their declarations, with only the names needed. */
function printImports(missing: Needed[], code: string): string[] {
  const order: Array<string | t.ImportDeclaration> = [];
  const specifiers = new Map<t.ImportDeclaration, t.ImportDeclaration['specifiers']>();

  for (const need of missing) {
    if (need.kind !== 'import') continue;

    if (need.text) {
      order.push(need.text);
    } else if (specifiers.has(need.declaration!)) {
      specifiers.get(need.declaration!)!.push(need.specifier!);
    } else {
      specifiers.set(need.declaration!, [need.specifier!]);
      order.push(need.declaration!);
    }
  }

  return order.map((line) => (typeof line === 'string' ? line : printImport(line, specifiers.get(line)!, code)));
}

function importedOf(specifier: t.ImportDeclaration['specifiers'][number]): string {
  if (t.isImportDefaultSpecifier(specifier)) return 'default';
  if (t.isImportNamespaceSpecifier(specifier)) return '*';

  return t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value;
}

function printImport(declaration: t.ImportDeclaration, specifiers: t.ImportDeclaration['specifiers'], code: string): string {
  const parts: string[] = [];
  const named: string[] = [];

  for (const specifier of specifiers) {
    if (t.isImportDefaultSpecifier(specifier)) {
      parts.unshift(specifier.local.name);
    } else if (t.isImportNamespaceSpecifier(specifier)) {
      parts.push(`* as ${specifier.local.name}`);
    } else {
      const imported = importedOf(specifier);
      const type = specifier.importKind === 'type' ? 'type ' : '';
      const name = t.isIdentifier(specifier.imported) ? imported : `'${imported}'`;

      named.push(`${type}${name}${imported === specifier.local.name ? '' : ` as ${specifier.local.name}`}`);
    }
  }

  if (named.length > 0) parts.push(`{ ${named.join(', ')} }`);

  const type = declaration.importKind === 'type' ? 'type ' : '';

  return `import ${type}${parts.join(', ')} from ${slice(code, declaration.source)};`;
}

/** The extend file the extension has: its exported array, and the names it binds. */
function parseExtend(code: string): Existing | { reason: string } {
  let ast: t.File;

  try {
    ast = parse(code) as t.File;
  } catch {
    return { reason: 'could not be parsed' };
  }

  const exported = ast.program.body.find((node): node is t.ExportDefaultDeclaration => t.isExportDefaultDeclaration(node));

  if (!exported || !t.isArrayExpression(exported.declaration)) {
    return { reason: 'does not export an array the upgrade can add to' };
  }

  const bindings = new Map<string, Needed>();
  let lastImportEnd: number | null = null;

  for (const node of ast.program.body) {
    if (t.isImportDeclaration(node)) {
      lastImportEnd = node.end!;

      for (const specifier of node.specifiers) {
        bindings.set(specifier.local.name, {
          name: specifier.local.name,
          kind: 'import',
          source: node.source.value,
          imported: importedOf(specifier),
          typeOnly: isTypeOnly(node, specifier),
        });
      }

      continue;
    }

    const declaration = t.isExportNamedDeclaration(node) ? node.declaration : node;

    if (t.isVariableDeclaration(declaration)) {
      for (const declarator of declaration.declarations) {
        if (t.isIdentifier(declarator.id)) {
          bindings.set(declarator.id.name, { name: declarator.id.name, text: `${declaration.kind} ${slice(code, declarator)};`, kind: 'const' });
        }
      }
    } else if ((t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration)) && declaration.id) {
      bindings.set(declaration.id.name, { name: declaration.id.name, text: slice(code, declaration), kind: 'const' });
    }
  }

  return { ast, array: exported.declaration, bindings, lastImportEnd };
}

/** Whether what the file has will do for what is needed: a type-only import will not do for a value. */
function sameBinding(has: Needed, need: Needed): boolean {
  if (has.kind === 'import' && need.kind === 'import') {
    return has.source === need.source && has.imported === need.imported && (need.typeOnly || !has.typeOnly);
  }

  return has.kind === need.kind && has.text === need.text;
}

function newExtend(imports: string[], constants: string[], extenders: string[], common: boolean): string {
  const elements = [...(common ? ['...commonExtend'] : []), ...extenders];

  return [imports.join('\n'), constants.join('\n'), `export default [\n${elements.join(',\n\n')},\n];\n`].filter(Boolean).join('\n\n');
}

function appendTo(code: string, existing: Existing, imports: string[], constants: string[], extenders: string[]): string {
  const edits: Edit[] = [];

  const head = [imports.join('\n'), constants.length > 0 ? '\n' + constants.join('\n') : ''].filter(Boolean).join('\n');

  if (head) {
    const at = existing.lastImportEnd ?? 0;

    edits.push({ start: at, end: at, text: existing.lastImportEnd === null ? head + '\n\n' : '\n' + head });
  }

  // After what the array has, comments included, with a blank line after an element.
  const elements = existing.array.elements;
  const last = elements[elements.length - 1];
  const open = last ? last.end! : existing.array.start! + 1;
  const close = existing.array.end! - 1;
  const between = code.slice(open, close).replace(/\s+$/, '');
  const comma = last && !between.replace(/\/\/[^\n]*|\/\*[\S\s]*?\*\//g, '').includes(',') ? ',' : '';
  const gap = last && !/(\/\/[^\n]*|\*\/)$/.test(between) ? '\n\n' : '\n';

  edits.push({ start: open, end: close, text: comma + between + gap + extenders.join(',\n\n') + ',\n' });

  return applyEdits(code, edits);
}

/** The index without the moved registrations and what only they used, exporting extend. */
function indexEdits(
  code: string,
  program: NodePath<t.Program>,
  registrations: Registration[],
  imports: Map<string, Binding>,
  constants: Set<Binding>,
  target: Target
): string {
  const edits: Edit[] = [];
  const moved = new Set<t.Node>(registrations.map((registration) => registration.statement.node));
  const emptied = emptiedInitializers(registrations, moved);

  // An initializer left with nothing to do goes as a whole. 2.0 checks
  // whether an extension is enabled in flarum.extensions, not by its
  // initializer, so nothing needs it to stay.
  // The app it added itself to may now go unused too.
  const candidates = new Map(imports);

  for (const initializer of emptied) {
    moved.add(initializer.node);
    edits.push(removal(code, initializer));

    const app = initializer.get('expression.callee.object.object') as NodePath;
    const binding = app.isIdentifier() ? app.scope.getBinding(app.node.name) : undefined;

    if (binding && isImport(binding)) candidates.set(binding.identifier.name, binding);
  }

  for (const registration of registrations) {
    if (!emptied.some((initializer) => registration.statement.isDescendant(initializer))) {
      edits.push(removal(code, registration.statement));
    }
  }

  // A constant only the moved code, or another constant going, used goes too.
  const going = new Set<Binding>();
  let changed = true;

  while (changed) {
    changed = false;

    for (const constant of constants) {
      if (going.has(constant) || isExported(constant)) continue;

      const used = constant.referencePaths.some(
        (reference) => !reference.findParent((parent) => moved.has(parent.node) || [...going].some((other) => other.path.node === parent.node))
      );

      if (!used) {
        going.add(constant);
        changed = true;
      }
    }
  }

  // The for() names a constant as well.
  for (const registration of registrations) {
    const forArg = chainRoot(registration).arguments[0];

    if (t.isIdentifier(forArg)) {
      const binding = registration.statement.scope.getBinding(forArg.name);

      if (binding && !isImport(binding) && !isExported(binding) && !going.has(binding)) {
        const used = binding.referencePaths.some((reference) => !reference.findParent((parent) => moved.has(parent.node)));

        if (!used) going.add(binding);
      }
    }
  }

  for (const constant of going) {
    const declaration = constant.path.parentPath as NodePath<t.VariableDeclaration>;
    const remaining = declaration.node.declarations.filter((declarator) => ![...going].some((other) => other.path.node === declarator));

    edits.push(
      remaining.length === 0
        ? wholeLines(code, declaration.node)
        : {
            start: declaration.node.start!,
            end: declaration.node.end!,
            text: `${declaration.node.kind} ${remaining.map((d) => slice(code, d)).join(', ')};`,
          }
    );
  }

  // An import only the moved code, or constants going, used.
  const outside = (reference: NodePath) =>
    !reference.findParent((parent) => moved.has(parent.node) || [...going].some((g) => g.path.parentPath!.node === parent.node));
  const byDeclaration = new Map<t.ImportDeclaration, t.Node[]>();

  for (const binding of candidates.values()) {
    if (references(program, binding).some(outside)) continue;

    const declaration = binding.path.parent as t.ImportDeclaration;

    byDeclaration.set(declaration, [...(byDeclaration.get(declaration) ?? []), binding.path.node]);
  }

  const removedImports = new Set<t.ImportDeclaration>();

  for (const [declaration, unused] of byDeclaration) {
    const remaining = declaration.specifiers.filter((specifier) => !unused.includes(specifier));

    if (remaining.length === 0) {
      removedImports.add(declaration);
      edits.push(wholeLines(code, declaration));
    } else {
      edits.push({ start: declaration.start!, end: declaration.end!, text: printImport(declaration, remaining, code) });
    }
  }

  // Export extend from the new file.
  if (target.common) {
    const source = target.common.declaration.source!;

    edits.push({ start: source.start!, end: source.end!, text: "'./extend'" });
  } else if (target.existing === null) {
    const lastImport = [...program.node.body].reverse().find((node) => t.isImportDeclaration(node) && !removedImports.has(node));
    const line = "export { default as extend } from './extend';";

    edits.push(lastImport ? { start: lastImport.end!, end: lastImport.end!, text: `\n\n${line}` } : { start: 0, end: 0, text: `${line}\n\n` });
  }

  return applyEdits(code, edits);
}

const chainRoot = (registration: Registration): t.CallExpression => (registration.calls[0].callee as t.MemberExpression).object as t.CallExpression;

function isExported(binding: Binding): boolean {
  return Boolean(binding.path.parentPath?.parentPath?.isExportNamedDeclaration());
}

/** Every reference to a binding, including in types, which Babel does not count. */
function references(program: NodePath<t.Program>, binding: Binding): NodePath[] {
  const found: NodePath[] = [];

  const visit = (p: NodePath<t.Identifier | t.JSXIdentifier>) => {
    if (p.isReferencedIdentifier() && p.scope.getBinding(p.node.name) === binding) found.push(p);
  };

  program.traverse({ Identifier: visit, JSXIdentifier: visit });

  return found;
}

/**
 * The `app.initializers.add(...)` statements that only held registrations
 * which are moving, and no comments of their own.
 */
function emptiedInitializers(registrations: Registration[], moved: Set<t.Node>): NodePath<t.ExpressionStatement>[] {
  const emptied: NodePath<t.ExpressionStatement>[] = [];

  for (const registration of registrations) {
    const block = registration.statement.parentPath as NodePath<t.BlockStatement>;
    const statement = block.parentPath?.parentPath?.parentPath;

    if (!statement?.isExpressionStatement() || emptied.some((other) => other.node === statement.node)) continue;

    const body = block.node.body;
    const removed = new Set(body.flatMap((node) => node.leadingComments ?? []));
    const kept = [...(block.node.innerComments ?? []), ...(body.at(-1)?.trailingComments ?? [])].filter((comment) => !removed.has(comment));

    if (body.every((node) => moved.has(node)) && kept.length === 0) {
      emptied.push(statement);
    }
  }

  return emptied;
}

/** The statement's lines, with the comments above it and one ending its line. */
function removal(code: string, statement: NodePath<t.Statement>): Edit {
  const node = statement.node;
  const parent = statement.parentPath!.node as t.BlockStatement | t.Program;
  const previous = parent.body[parent.body.indexOf(node) - 1];
  const leading = (node.leadingComments ?? []).filter((comment) => !previous || comment.loc!.start.line > previous.loc!.end.line);
  const start = leading.length > 0 ? leading[0].start! : node.start!;

  return wholeLines(code, { start, end: node.end! } as t.Node);
}

/** A node's lines, when nothing else is on them; otherwise just the node. */
function wholeLines(code: string, node: t.Node): Edit {
  const lineStart = code.lastIndexOf('\n', node.start! - 1) + 1;
  const lineEnd = code.indexOf('\n', node.end!);
  const end = lineEnd === -1 ? code.length : lineEnd + 1;

  const before = code.slice(lineStart, node.start!);
  const after = code.slice(node.end!, end);

  if (before.trim() === '' && after.trim() === '') {
    return { start: lineStart, end, text: '' };
  }

  return { start: node.start!, end: node.end!, text: '' };
}

function applyEdits(code: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].end > sorted[i - 1].start && sorted[i].start !== sorted[i].end) {
      throw new Error('The upgrade tried to change the same code twice.');
    }
  }

  return sorted.reduce((result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end), code);
}
