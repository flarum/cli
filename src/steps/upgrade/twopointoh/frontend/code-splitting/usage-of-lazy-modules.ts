import { BaseUpgradeStep, GitCommit, Replacement } from '../../base';
import chalk from 'chalk';
import * as t from '@babel/types';
import * as recast from 'recast';
import traverse from '@babel/traverse';

export default class UsageOfLazyModules extends BaseUpgradeStep {
  type = 'Adapt to accessing/extending lazy loaded Flarum modules.';

  // Array.from(flarum.reg.chunks.entries().flatMap(e => e[1].modules.map(m => e[1].namespace + ':' + m))).join('\n')
  // LabelValue and LoadingPost were lazy once, and are in the main bundle
  // now (flarum/framework#4235), so they are imported as usual.
  // core:forum/components/ReplyComposer
  // core:forum/components/ComposerBody
  // core:common/components/ConfirmDocumentUnload
  // core:forum/components/LogInModal
  // core:forum/components/ForgotPasswordModal
  // core:forum/components/PostStream
  // core:forum/components/ReplyPlaceholder
  // core:forum/components/PostStreamScrubber
  // core:forum/components/SearchModal
  // core:forum/components/SignUpModal
  // core:forum/components/EditPostComposer
  // core:forum/components/ComposerBody
  // core:common/components/ConfirmDocumentUnload
  // core:common/components/EditUserModal
  // core:forum/components/DiscussionComposer
  // core:forum/components/DiscussionsUserPage
  // core:forum/components/SettingsPage
  // core:forum/components/NotificationGrid
  // core:forum/components/ChangePasswordModal
  // core:forum/components/ChangeEmailModal
  // core:forum/components/UserSecurityPage
  // core:forum/components/AccessTokensList
  // core:forum/components/NewAccessTokenModal
  // core:forum/states/UserSecurityPageState
  // core:forum/components/NotificationsPage
  // core:forum/components/Composer
  // core:forum/components/ComposerButton
  // flarum-tags:forum/components/TagDiscussionModal
  // flarum-tags:common/components/TagSelectionModal
  // flarum-tags:forum/components/ToggleButton
  // flarum-emoji:forum/emojiMap

  private lazyModules: Record<string, Record<string, string[]>> = {
    flarum: {
      admin: [],
      forum: [
        'Composer',
        'DiscussionsUserPage',
        'ForgotPasswordModal',
        'NotificationsPage',
        'ComposerBody',
        'ReplyPlaceholder',
        'PostStreamScrubber',
        'SignUpModal',
        'DiscussionComposer',
        'EditPostComposer',
        'LogInModal',
        'PostStream',
        'ReplyComposer',
        'SettingsPage',
        'NotificationGrid',
        'ChangePasswordModal',
        'ChangeEmailModal',
        'UserSecurityPage',
        'AccessTokensList',
        'NewAccessTokenModal',
        'UserSecurityPageState',
        'ComposerButton',
      ],
      common: ['EditUserModal', 'ConfirmDocumentUnload', 'SearchModal'],
    },
    'flarum/tags': {
      admin: [],
      forum: ['TagDiscussionModal', 'ToggleButton'],
      common: ['TagSelectionModal'],
    },
    'flarum/emoji': {
      admin: [],
      forum: ['emojiMap'],
      common: [],
    },
    current: {
      admin: [],
      forum: [],
      common: [],
    },
  };

  private composers = ['ComposerBody', 'DiscussionComposer', 'ReplyComposer', 'EditPostComposer'];

  replacements(file: string): Replacement[] {
    if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.jsx')) {
      return [this.updateModalShow(), this.updateComposerLoad(), this.updateExtending(), this.updateMatches(), this.removeImportLines()];
    }

    if (file.includes('extend.php')) {
      return [this.addJsDirectoryExtender()];
    }

    return [];
  }

  targets(): string[] {
    return ['js/src/**/*', 'extend.php'];
  }

  gitCommit(): GitCommit {
    return {
      message: 'chore(2.0): adapt to extending lazy modules',
      description: 'Some Flarum modules are now lazy loaded. Extending them requires a different approach.',
    };
  }

  pauseMessage(): string {
    const readMore = chalk.dim('Read more about code splitting in Flarum 2.0: https://docs.flarum.org/2.x/extend/code-splitting');
    const lazyLoaded = chalk.bgYellow.bold('lazy loaded');

    return `Flarum 2.0 introduces code splitting functionality. Some modules are now ${lazyLoaded}. And extending them requires a different approach.
                     The tool has attempted to update your code accordingly. Please review the changes and ensure everything is correct.
                     ${readMore}`;
  }

  protected beforeHook = true;

  before(file: string, code: string): void {
    if (!file.endsWith('.js') && !file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.jsx')) return;

    const frontend = file.split('/src/')[1].split('/')[0];

    if (!['forum', 'admin', 'common'].includes(frontend)) return;

    const lazyModules = this.lazyModules.current[frontend];

    this.forEachLazyModule(code, ({ module, importPath }) => {
      // If any module from this extension extends a lazy core module,
      // then they need to be considered as modules that must be lazy loaded as well.

      if (code.includes(' extends ' + module) && code.includes(importPath)) {
        const localModule = code.match(new RegExp('class (\\w+) extends ' + module))?.[1];

        if (localModule) {
          lazyModules.push(localModule);

          if (this.composers.includes(module)) {
            this.composers.push(localModule);
          }
        }
      }
    });

    this.lazyModules.current[frontend] = lazyModules;
  }

  updateModalShow(): Replacement {
    return (_file, code, advanced) => {
      const ast = advanced as t.File;

      this.forEachLazyModule(code, ({ module, importPath }) => {
        // before = app.modal.show(${module}, { ... }, ...);
        // after = app.modal.show(() => import('${importPath}'), { ... }, ...);

        traverse(ast, {
          MemberExpression(path) {
            const node = path.node;
            const object = node.object;
            const call = path.parent;

            if (!t.isMemberExpression(object)) return;

            if (!t.isCallExpression(call)) return;

            if (
              t.isIdentifier(node.property) &&
              node.property.name === 'show' &&
              t.isIdentifier(object.property) &&
              object.property.name === 'modal' &&
              t.isIdentifier(object.object) &&
              object.object.name === 'app'
            ) {
              const args = call.arguments;

              if (args.length === 0) return;

              const firstArg = args[0];

              if (t.isIdentifier(firstArg) && firstArg.name === module) {
                args[0] = t.arrowFunctionExpression([], t.callExpression(t.import(), [t.stringLiteral(importPath)]));
              }
            }
          },
        });
      });

      return {
        updated: ast,
      };
    };
  }

  updateComposerLoad(): Replacement {
    return (_file, code, advanced) => {
      const ast = advanced as t.File;

      this.forEachLazyModule(code, ({ module, importPath }) => {
        // before = app.composer.load(${module}, { ... }, ...);
        // after = app.composer.load(() => import('${importPath}'), { ... }, ...);

        const lines: (t.ExpressionStatement | t.MemberExpression)[] = [];

        const composers = this.composers;

        // pick up {module}.prototype... lines to add to the .then(() => { lines }) at the end of the call expression.
        traverse(ast, {
          ExpressionStatement(path) {
            // collect lines, for example:
            // {module}.prototype.attribute = 'value';

            const node = path.node;
            const expression = node.expression;

            if (!t.isAssignmentExpression(expression)) return;

            const left = expression.left;

            if (!t.isMemberExpression(left)) return;

            const prototypeExpression = left.object;

            if (!t.isMemberExpression(prototypeExpression)) return;

            const property = prototypeExpression.property;

            if (!t.isIdentifier(property) || property.name !== 'prototype') return;

            const object = prototypeExpression.object;

            if (!t.isIdentifier(object)) return;

            if (object.name !== module) return;

            if (composers.includes(module)) {
              lines.push(node);
              path.remove();
            } else if (
              (t.isFunctionExpression(expression.right) || t.isArrowFunctionExpression(expression.right)) &&
              (t.isIdentifier(left.property) || t.isStringLiteral(left.property))
            ) {
              // SettingsPage.prototype['draftsItems'] = ...;
              // change to extend('flarum/forum/components/SettingsPage', 'draftItems', ...);
              const methodName = t.isIdentifier(left.property) ? left.property.name : left.property.value;
              const extend = t.callExpression(t.identifier('extend'), [t.stringLiteral(importPath), t.stringLiteral(methodName), expression.right]);

              path.replaceWith(t.expressionStatement(extend));
            }
          },
        });

        const newLines = lines.map((line) => {
          return t.isExpressionStatement(line) ? line : t.expressionStatement(line);
        });

        let done = false;

        traverse(ast, {
          CallExpression(path) {
            if (done) return;

            const call = path.node;
            const node = call.callee;

            if (!t.isMemberExpression(node)) return;

            const object = node.object;

            if (!t.isMemberExpression(object)) return;

            if (!t.isCallExpression(call)) return;

            if (
              t.isIdentifier(node.property) &&
              node.property.name === 'load' &&
              t.isIdentifier(object.property) &&
              object.property.name === 'composer' &&
              t.isIdentifier(object.object) &&
              object.object.name === 'app'
            ) {
              const args = call.arguments;

              if (args.length === 0) return;

              const firstArg = args[0];

              if (!t.isIdentifier(firstArg) || firstArg.name !== module) {
                // @ts-ignore
                call.comments = [
                  recast.types.builders.commentLine(
                    ' @TODO: Modify this to use lazy loading, checkout https://docs.flarum.org/2.x/extend/code-splitting#async-composers',
                    true,
                    false
                  ),
                ];

                return;
              }

              args[0] = t.arrowFunctionExpression([], t.callExpression(t.import(), [t.stringLiteral(importPath)]));

              (function (path) {
                const siblingPath = path.parentPath.getNextSibling();
                let siblingCall = siblingPath.node;

                if (t.isExpressionStatement(siblingCall)) {
                  siblingCall = siblingCall.expression;
                }

                if (!t.isCallExpression(siblingCall)) return;

                const siblingNode = siblingCall.callee;

                if (!t.isMemberExpression(siblingNode)) return;

                const siblingObject = siblingNode.object;

                if (!t.isMemberExpression(siblingObject)) return;

                if (
                  t.isIdentifier(siblingNode.property) &&
                  siblingNode.property.name === 'show' &&
                  t.isIdentifier(siblingObject.property) &&
                  siblingObject.property.name === 'composer' &&
                  t.isIdentifier(siblingObject.object) &&
                  siblingObject.object.name === 'app'
                ) {
                  newLines.push(t.expressionStatement(siblingCall));
                  siblingPath.remove();
                }
              })(path);

              let lineToComment = newLines[0] ?? null;

              if (!lineToComment) {
                lineToComment = t.expressionStatement(t.identifier(''));
                newLines.push(lineToComment);
              }

              const comment =
                ' @TODO: Move all direct access to the module object here. Including subsequent calls to app.composer.show(), checkout https://docs.flarum.org/2.x/extend/code-splitting#async-composers';

              // @ts-ignore
              lineToComment.comments = [recast.types.builders.commentLine(comment, true, false)];

              // Add (...).then(() => { lines }) to the call expression.
              const then = t.memberExpression(path.node, t.identifier('then'));
              const body = t.blockStatement(newLines);
              const thenArgs = [t.arrowFunctionExpression([t.identifier(module)], body)];
              const thenCall = t.callExpression(then, thenArgs);

              path.replaceWith(thenCall);

              done = true;
            }
          },
        });
      });

      return {
        updated: ast,
      };
    };
  }

  updateExtending(): Replacement {
    return (_file, code) => {
      this.forEachLazyModule(code, ({ module, importPath, importedAs }) => {
        const beforeExtend = `extend\\(${module}\\.prototype,`;
        const afterExtend = `extend('${importPath}',`;
        const beforeOverride = `override\\(${module}\\.prototype,`;
        const afterOverride = `override('${importPath}',`;

        code = code
          // first the extend/override format.
          .replace(new RegExp(beforeExtend, 'g'), afterExtend)
          .replace(new RegExp(beforeOverride, 'g'), afterOverride);

        // If there are still usages of the module apart from extend/override
        // add a to do comment for the extension developer.
        const match = code.match(new RegExp(`${importedAs}[^'"]`, 'g'));
        const exists = match && match.length > 1;

        if (exists) {
          code = code.replace(
            new RegExp(`(^${importedAs}[^'"].*$)`, 'gm'),
            `$1 // @TODO: Check if this usage is correct. Lazy loaded modules must be loaded using the async import function. https://docs.flarum.org/2.x/extend/code-splitting`
          );
        }
      });

      return {
        updated: code,
      };
    };
  }

  updateMatches(): Replacement {
    return (_file, code) => {
      this.forEachLazyModule(code, ({ module, importPath }) => {
        code = code
          .replace(new RegExp(`composer\\.bodyMatches\\(${module}\\)`, 'g'), `composer.bodyMatches('${importPath}')`)
          .replace(new RegExp(`\\.state\\.bodyMatches\\(${module}\\)`, 'g'), `.state.bodyMatches('${importPath}')`)
          .replace(new RegExp(`app\\.current\\.matches\\(${module}\\)`, 'g'), `app.current.matches('${importPath}')`);
      });

      return {
        updated: code,
      };
    };
  }

  removeImportLines(): Replacement {
    return (_file, code) => {
      this.forEachLazyModule(code, ({ module, importPath, importedAs, importLine }) => {
        if (code.includes(` extends ${module}`)) {
          return;
        }

        // Types are erased from the build, so a type import costs nothing.
        if (/^type\s/.test(importedAs.trim())) {
          return;
        }

        // The other replacements load what they can as it's needed. Whatever
        // still uses the import, such as JSX rendering the component, would
        // break without it, and only the author knows where to load it. A name
        // inside a string, such as a module path, is no use of it.
        const names = importedAs.match(/[$A-Z_a-z][\w$]*/g)?.filter((name) => name !== 'as' && name !== 'default') ?? [];
        const rest = code.replace(importLine, '');

        if (names.some((name) => new RegExp(`(?<![\\w$./'"])${name.replace(/\$/g, '\\$')}(?![\\w$'"])`).test(rest))) {
          const todo = `// @TODO: ${module} is lazy loaded in 2.0, so this import is undefined until its chunk has loaded. Load it with \`await import('${importPath}')\` before using it. https://docs.flarum.org/2.x/extend/code-splitting\n`;

          if (!code.includes(todo + importLine)) {
            code = code.replace(importLine, todo + importLine);
          }

          return;
        }

        code = code
          // then remove the import.
          .replace(importLine, '');
      });

      return {
        updated: code,
      };
    };
  }

  addJsDirectoryExtender(): Replacement {
    return (_file, code) => {
      if (
        this.lazyModules.current.forum.length === 0 &&
        this.lazyModules.current.admin.length === 0 &&
        this.lazyModules.current.common.length === 0
      ) {
        return null;
      }

      ['forum', 'admin', 'common'].forEach((frontend) => {
        const modules = this.lazyModules.current[frontend];

        if (modules.length === 0) {
          return;
        }

        const regex = new RegExp(`^(\\s+)(->js\\(__DIR__.'\\/js\\/dist\\/${frontend}\\.js'\\))`, 'gm');

        code = regex.test(code)
          ? code.replace(regex, `$1$2\n$1->jsDirectory(__DIR__ . '/js/dist/${frontend}')`)
          : code.replace('return [', `return [\n        (new Extend\\Frontend('${frontend}'))->jsDirectory(__DIR__ . '/js/dist/${frontend}'),`);
      });

      return {
        updated: code,
      };
    };
  }

  forEachLazyModule(
    code: string,
    callback: (options: {
      namespace: string;
      module: string;
      packageNamespace: string;
      importPath: string;
      importedAs: string;
      importLine: string;
    }) => void
  ): void {
    // eslint-disable-next-line guard-for-in
    for (const namespace in this.lazyModules) {
      const lazyModules = Object.values(this.lazyModules[namespace]).flat();
      let packageNamespace = namespace === 'flarum' ? 'flarum' : `ext:${namespace}`;

      if (namespace === 'current') {
        packageNamespace = '\\.{1,2}';
      }

      for (const lazyModule of lazyModules) {
        const regex = new RegExp(`import\\s+(.+)\\s+from '(${packageNamespace}/.+/${lazyModule})';\n`, 'gmi');
        const importMatch = regex.exec(code);
        const importLine = importMatch && importMatch[0];

        // if (code.includes("import UserControls from 'flarum/forum/utils/UserControls';")) {
        //   console.log(this.lazyModules.current);
        // }
        //
        // if (namespace === 'current' && code.includes("import UserControls from 'flarum/forum/utils/UserControls';")) {
        //   console.log('regex', regex);
        //   console.log('importMatch', importMatch);
        //   console.log(code)
        // }

        if (!importLine) {
          continue;
        }

        const importPath = importMatch[2];
        const importedAs = importMatch[1];

        callback({ namespace, module: lazyModule, packageNamespace, importPath, importedAs, importLine });
      }
    }
  }
}
