import * as t from '@babel/types';
import { MemberExpression, NewExpression } from '@babel/types';
import { ClosureSpec, ExpressionSpec, ExpressionType, MethodCallSpec } from '../providers/php-provider';
import prettier from 'prettier';
import prettierConfig from '@flarum/prettier-config/prettierrc.json';
// import { parse } from '@babel/parser';
// import generate from '@babel/generator';
import * as recast from 'recast';

export function parseCode(code: string): t.File {
  return recast.parse(code, {
    parser: require('recast/parsers/babel-ts'),
  });
}

export async function generateCode(ast: t.File, extenders = false): Promise<string> {
  // @ts-ignore
  const generatedCode = recast.print(ast, {
    parser: require('recast/parsers/babel-ts'),
  }).code;

  // Format the code
  return formatCode(generatedCode, extenders);
}

export type ModuleImport = {
  name: string;
  path: string;
  defaultImport: boolean;
  preferGroupImport?: boolean;
  useNamedGroupImport?: string | null;
};

export function applyImports(ast: t.File, frontend: string, modules: ModuleImport[]): { qualifiedModule: (name: string | ModuleImport) => string } {
  const defaultImports: Record<string, t.ImportDefaultSpecifier | null> = {};
  const specificImports: Record<string, t.ImportSpecifier[] | null> = {};

  modules.forEach((module) => populateImports(ast, module, defaultImports, specificImports, frontend));

  return {
    qualifiedModule(module: string | ModuleImport) {
      let isFullPath = true;

      if (typeof module === 'string') {
        isFullPath = module.includes('/');

        module = {
          name: module.split('/').pop()!,
          path: module,
          defaultImport: true,
        };
      }

      let specificImportDeclarations: (t.ImportSpecifier | null)[] | null = null;

      if (isFullPath) {
        specificImportDeclarations = specificImports[`${module.path}:${module.name}`];
      } else {
        Object.keys(specificImports).forEach((key) => {
          if (key.endsWith(`:${(module as ModuleImport).name}`)) {
            specificImportDeclarations = specificImports[key];
          }
        });
      }

      const specifier = specificImportDeclarations?.find(
        (specifier) => (specifier?.imported as t.Identifier)?.name === (module as ModuleImport).name
      );

      if (specifier) {
        return specifier.local.name;
      }

      let defaultImportDeclaration: t.ImportDefaultSpecifier | null = null;

      if (isFullPath) {
        defaultImportDeclaration = defaultImports[`${(module as ModuleImport).path}:${(module as ModuleImport).name}`];
      } else {
        Object.keys(defaultImports).forEach((key) => {
          if (key.endsWith(`:${(module as ModuleImport).name}`)) {
            defaultImportDeclaration = defaultImports[key];
          }
        });
      }

      if (!module.defaultImport || module.preferGroupImport || defaultImportDeclaration?.local.name !== module.name) {
        return `${defaultImportDeclaration!.local.name}.${module.name}`;
      }

      return defaultImportDeclaration?.local.name || module.name;
    },
  };
}

function relativizePath(path: string, root: string) {
  return path.replace(new RegExp(`^${root}`), '.').replace(/^common/, '../common');
}

export function populateImports(
  ast: t.File,
  module: ModuleImport,
  defaultImports: Record<string, t.ImportDefaultSpecifier | null>,
  specificImports: Record<string, t.ImportSpecifier[] | null>,
  frontend: string,
  insertAt: number | null = null
): void {
  const preferDefaultImport = module.defaultImport || (module.preferGroupImport && module.useNamedGroupImport);
  let defaultImportDeclaration = null;
  const relativePath = relativizePath(module.path, frontend);

  const searchedPaths = [relativePath];

  if (module.preferGroupImport || module.defaultImport) {
    searchedPaths.push(relativePath.split('/').slice(0, -1).join('/'));
  }

  if (preferDefaultImport) {
    defaultImportDeclaration = ((
      ast.program.body.find((node) => {
        return (
          node.type === 'ImportDeclaration' &&
          searchedPaths.includes(node.source.value) &&
          node.specifiers.some((specifier) => specifier.type === 'ImportDefaultSpecifier')
        );
      }) as t.ImportDeclaration | undefined
    )?.specifiers[0] ?? null) as t.ImportDefaultSpecifier | null;
  }

  let specificImportDeclarations = (
    ast.program.body.find((node) => {
      return (
        node.type === 'ImportDeclaration' &&
        searchedPaths.includes(node.source.value) &&
        node.specifiers.some((specifier) => specifier.type === 'ImportSpecifier')
      );
    }) as t.ImportDeclaration | undefined
  )?.specifiers as t.ImportSpecifier[] | null;

  if (!defaultImportDeclaration && !specificImportDeclarations?.length && preferDefaultImport) {
    if (!module.preferGroupImport) {
      defaultImportDeclaration = t.importDefaultSpecifier(t.identifier(module.name));

      const declaration = t.importDeclaration([defaultImportDeclaration], t.stringLiteral(relativePath));

      if (!insertAt) {
        ast.program.body.unshift(declaration);
      } else {
        ast.program.body.splice(insertAt, 0, declaration);
      }
    } else if (module.useNamedGroupImport) {
      defaultImportDeclaration = t.importDefaultSpecifier(t.identifier(module.useNamedGroupImport));

      const declaration = t.importDeclaration([defaultImportDeclaration], t.stringLiteral(relativePath.split('/').slice(0, -1).join('/')));

      if (!insertAt) {
        ast.program.body.unshift(declaration);
      } else {
        ast.program.body.splice(insertAt, 0, declaration);
      }
    }
  }

  if (
    !defaultImportDeclaration &&
    ((specificImportDeclarations && specificImportDeclarations.length > 0) ||
      (module.preferGroupImport && !module.useNamedGroupImport) ||
      (!module.defaultImport && !module.preferGroupImport))
  ) {
    const imported = new Set(specificImportDeclarations?.map((specifier) => (specifier.imported as t.Identifier).name) || []);
    const notImported = !imported.has(module.name);

    if (notImported) {
      const path = relativizePath(module.preferGroupImport ? module.path.split('/').slice(0, -1).join('/') : module.path, frontend);
      const newImports = t.importDeclaration([t.importSpecifier(t.identifier(module.name), t.identifier(module.name))], t.stringLiteral(path));

      if (specificImportDeclarations) {
        specificImportDeclarations.push(...(newImports.specifiers as t.ImportSpecifier[]));
      } else {
        specificImportDeclarations = newImports.specifiers as t.ImportSpecifier[];

        if (!insertAt) {
          ast.program.body.unshift(newImports);
        } else {
          ast.program.body.splice(insertAt, 0, newImports);
        }
      }
    }
  }

  defaultImports[`${module.path}:${module.name}`] = defaultImportDeclaration;
  specificImports[`${module.path}:${module.name}`] = specificImportDeclarations;
}

export function findNewExpressionWithinNestedMemberExpression(memberExpression: MemberExpression): NewExpression | null {
  if (memberExpression.object.type === 'NewExpression') {
    return memberExpression.object as t.NewExpression;
  }

  if (memberExpression.object.type === 'CallExpression' && memberExpression.object.callee.type === 'MemberExpression') {
    return findNewExpressionWithinNestedMemberExpression(memberExpression.object.callee as t.MemberExpression);
  }

  return null;
}

export function findCallExpression(newExtender: t.NewExpression | t.SequenceExpression | t.CallExpression, methodCall: MethodCallSpec): boolean {
  if (newExtender.type === 'NewExpression' || newExtender.type === 'SequenceExpression') {
    return false;
  }

  let found =
    newExtender.type === 'CallExpression' &&
    newExtender.callee.type === 'MemberExpression' &&
    newExtender.callee.property.type === 'Identifier' &&
    newExtender.callee.property.name === methodCall.methodName &&
    JSON.stringify(newExtender.arguments.map((arg) => (arg as t.StringLiteral).value)) ===
      JSON.stringify((methodCall.args || []).map((arg) => arg.value));

  if (!found && newExtender.callee.type === 'MemberExpression' && newExtender.callee.object.type === 'CallExpression') {
    found = findCallExpression(newExtender.callee.object, methodCall);
  }

  return found;
}

export function argumentsExpressions(args: ExpressionSpec[]): Array<t.Expression> {
  return args.map((arg) => {
    switch (arg.type) {
      case ExpressionType.SCALAR:
        return t.stringLiteral(arg.value as string);
      case ExpressionType.CLASS_CONST:
        return t.identifier((arg.value as string).split('/').pop() as string);
      case ExpressionType.CLOSURE:
        return t.arrowFunctionExpression(
          (arg.value as ClosureSpec).params.map((param) => t.identifier(param.name)),
          t.blockStatement([])
        );
      // case ExpressionType.VARIABLE:
      default:
        return t.identifier(arg.value as string);
    }
  });
}

export function sameArguments(
  ast: t.File,
  usedArguments: Array<t.Expression | t.SpreadElement | t.JSXNamespacedName | t.ArgumentPlaceholder>,
  extenderArgs: ExpressionSpec[] | undefined
) {
  const argumentValues = usedArguments
    .map((arg) => {
      if (arg.type === 'StringLiteral') {
        return arg.value;
      }

      // return full module path
      if (arg.type === 'Identifier') {
        const path = (
          ast.program.body.find((node) => {
            return node.type === 'ImportDeclaration' && node.specifiers.some((specifier) => specifier.local.name === arg.name);
          }) as t.ImportDeclaration | undefined
        )?.source.value;

        return path ? `${path}/${arg.name}` : arg.name;
      }

      return null;
    })
    .filter((value) => value !== null);

  const configuredArgs = extenderArgs?.map((arg) => arg.value) || [];

  return JSON.stringify(argumentValues) === JSON.stringify(configuredArgs);
}

export function formatCode(code: string, extenders = false): Promise<string> {
  const options = { ...(prettierConfig as prettier.Options), parser: 'babel-ts' };

  if (extenders) {
    options.printWidth = 100;
  }

  return prettier.format(code, options);
}

export function getFunctionName(node: t.Node): string | null {
  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'MemberExpression') {
    return `${getFunctionName(node.object)}.${getFunctionName(node.property)}`;
  }

  return null;
}
