import { BaseUpgradeStep, GitCommit, ImportChange, Replacement } from '../base';
import chalk from 'chalk';
import * as t from '@babel/types';
import traverse from '@babel/traverse';
import fs from 'fs';
import path from 'path';
import { parse } from 'recast/parsers/babel-ts';
import { getFunctionName } from '../../../../utils/ast';
import { extensionId } from '../../../../utils/composer';

/** The bundled extensions' IDs, which are their initializers' names in 2.0. */
const BUNDLED = new Set([
  'flarum-akismet',
  'flarum-approval',
  'flarum-audit',
  'flarum-bbcode',
  'flarum-deck',
  'flarum-embed',
  'flarum-emoji',
  'flarum-extension-manager',
  'flarum-flags',
  'flarum-gdpr',
  'flarum-lang-english',
  'flarum-likes',
  'flarum-lock',
  'flarum-markdown',
  'flarum-mentions',
  'flarum-messages',
  'flarum-nicknames',
  'flarum-pusher',
  'flarum-realtime',
  'flarum-statistics',
  'flarum-sticky',
  'flarum-subscriptions',
  'flarum-suspend',
  'flarum-tags',
]);

/** The 1.x names of the bundled initializers 2.0 renamed (flarum/framework#4003). */
const RENAMED: Record<string, string> = {
  lock: 'flarum-lock',
  subscriptions: 'flarum-subscriptions',
  'flarum/nicknames': 'flarum-nicknames',
};

const CHECK_TODO = "@TODO: check whether the extension is enabled with '<its extension ID>' in flarum.extensions instead";

export default class MiscFrontendChanges extends BaseUpgradeStep {
  type = 'Miscellaneous frontend changes.';

  // - [`IndexPage.prototype.sidebar` -> `IndexSidebar`](https://github.com/flarum/framework/blob/72f89c0209a5c4bbdc5482ecbdc2435dcd57550f/framework/core/js/src/forum/components/IndexSidebar.tsx)
  // - [`IndexPage.prototype.navItems` -> `IndexSidebar.prototype.navItems`](https://github.com/flarum/framework/blob/72f89c0209a5c4bbdc5482ecbdc2435dcd57550f/framework/core/js/src/forum/components/IndexSidebar.tsx)
  // - [`IndexPage.prototype.sidebarItems` -> `IndexSidebar.prototype.items`](https://github.com/flarum/framework/blob/72f89c0209a5c4bbdc5482ecbdc2435dcd57550f/framework/core/js/src/forum/components/IndexSidebar.tsx)
  // - `IndexPage.prototype.currentTag` -> `app.currentTag`
  // - `avatar(...)`  `icon(...)` -> `<Avatar ... />` `<Icon ... />`
  // - `this.currentTag` -> `app.currentTag`
  // - `UploadImageButton` namespace `admin` -> `common`

  replacements(file: string): Replacement[] {
    if (!file.endsWith('.js') && !file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.jsx')) return [];

    return [
      this.usePageStructure(),
      this.useHeaderDropdown(),
      this.useForm(),
      this.updateIndexPage(),
      this.updateAvatarIcon(),
      this.updateOtherRefs(),
      this.updateInitializers(),
      this.updateUploadImageButton(),
      ...this.updateExtendModal(),
    ];
  }

  targets(): string[] {
    return ['js/src/**/*'];
  }

  gitCommit(): GitCommit {
    return {
      message: 'chore(2.0): misc frontend changes',
      description: 'Miscellaneous frontend changes',
    };
  }

  pauseMessage(): string {
    const link = 'https://docs.flarum.org/2.x/extend/update-2_0#miscellaneous';
    const readMore = chalk.dim(`Read more: ${link}`);

    return `Various breaking frontend changes have been made in 2.0. The tool has attempted to update your code accordingly.
                     Please review the changes and ensure everything is correct.
                     ${readMore}`;
  }

  private usePageStructure(): Replacement {
    return (file, code) => {
      if (!code.includes(' extends Page ') || !code.includes('flarum/common/components/Page')) return null;

      const pageName = file
        .split('/')
        .pop()!
        .replace(/\.\w+$/, '');

      const regex =
        /return \(\s*<div clas{2}Name="IndexPage">\s*{?(.*?hero.*?)}?\s*<div clas{2}Name="container">\s*<div clas{2}Name="sideNavContainer">\s*(<nav.*<\/nav>)\s*<div clas{2}Name="IndexPage-results sideNavOf{2}set">(.*?)(?:<\/div>\s*){4}\);/gs;

      if (!regex.test(code)) return null;

      return {
        imports: [
          {
            replacesPath: null,
            import: {
              name: 'PageStructure',
              defaultImport: true,
              path: 'flarum/forum/components/PageStructure',
            },
          },
          {
            replacesPath: null,
            import: {
              name: 'IndexSidebar',
              defaultImport: true,
              path: 'flarum/forum/components/IndexSidebar',
            },
          },
        ],
        updated: code
          .replace(
            regex,
            `
            return (<PageStructure className="${pageName}" hero={() => ($1)} sidebar={() => <IndexSidebar />}>
              $3
            </PageStructure>);`
          )
          .replace('className="IndexPage-', `className="${pageName}-`),
      };
    };
  }

  private useHeaderDropdown(): Replacement {
    return (_file, code) => {
      code = code.replace('flarum/common/components/NotificationsDropdown', 'flarum/forum/components/NotificationsDropdown');

      if (!code.includes(' extends NotificationsDropdown ') || !code.includes('flarum/forum/components/NotificationsDropdown')) return null;

      const regex =
        /getMenu\(\)\s*{\s*return\s*\(\s*<div className={'Dropdown-menu ' \+ this\.attrs\.menuClassName} onclick={this\.menuClick\.bind\(this\)}>\s*{this\.showing \?\s+(.*?)\s+:\s+''}\s+<\/div>\s+\);\s+}/gs;

      return {
        imports: [
          {
            replacesPath: 'flarum/forum/components/NotificationsDropdown',
            import: {
              name: 'HeaderDropdown',
              defaultImport: true,
              path: 'flarum/forum/components/HeaderDropdown',
            },
          },
        ],
        updated: code.replace(' extends NotificationsDropdown ', ' extends HeaderDropdown ').replace(
          regex,
          `
          getContent() {
            return $1;
          }`
        ),
      };
    };
  }

  private useForm(): Replacement {
    return (_file, code, advanced) => {
      if (!/<div className="Form(\s|")/gs.test(code)) return null;

      const ast = advanced as t.File;

      traverse(ast, {
        JSXElement(path) {
          const node = path.node.openingElement;

          if (t.isJSXIdentifier(node.name) && node.name.name === 'div' && node.attributes.length === 1) {
            const attr = node.attributes.find((attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'className');

            if (
              attr &&
              t.isJSXAttribute(attr) &&
              t.isJSXIdentifier(attr.name) &&
              t.isStringLiteral(attr.value) &&
              attr.value.value.split(' ').includes('Form')
            ) {
              const openingClone = t.cloneNode(node);
              openingClone.name = t.jsxIdentifier('Form');
              // remove the Form className while keeping other classes
              const newClassName = attr.value.value.replace(/\bForm\b/, '').trim();

              openingClone.attributes = newClassName
                ? openingClone.attributes.filter((attr) => {
                    if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'className') {
                      attr.value = t.stringLiteral(newClassName);
                      return true;
                    }

                    return true;
                  })
                : openingClone.attributes.filter((attr) => {
                    return !(t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'className');
                  });

              const closingClone = t.cloneNode(path.node.closingElement!);
              closingClone.name = t.jsxIdentifier('Form');

              const clone = t.cloneNode(path.node);
              clone.openingElement = openingClone;
              clone.closingElement = closingClone;

              path.replaceWith(clone);
            }
          }
        },
      });

      return {
        imports: [
          {
            import: {
              name: 'Form',
              defaultImport: true,
              path: 'flarum/common/components/Form',
            },
          },
        ],
        updated: ast,
      };
    };
  }

  private updateIndexPage(): Replacement {
    return (_file, code) => {
      if (
        !code.includes('IndexPage.prototype.sidebar') &&
        !code.includes('IndexPage.prototype.navItems') &&
        !code.includes('IndexPage.prototype.sidebarItems') &&
        !code.includes('IndexPage.prototype.currentTag') &&
        !code.includes("IndexPage.prototype, 'sidebar'") &&
        !code.includes("IndexPage.prototype, 'navItems'") &&
        !code.includes("IndexPage.prototype, 'sidebarItems'")
      )
        return null;

      return {
        imports: [
          {
            import: {
              name: 'IndexSidebar',
              defaultImport: true,
              path: 'flarum/forum/components/IndexSidebar',
            },
          },
        ],
        updated: code
          .replace(/IndexPage\.prototype\.sidebarItems/g, 'IndexSidebar.prototype.items')
          .replace("IndexPage.prototype, 'sidebarItems'", "IndexSidebar.prototype, 'items'")
          .replace(/IndexPage\.prototype\.sidebar/g, 'IndexSidebar')
          .replace("IndexPage.prototype, 'sidebar'", "IndexSidebar.prototype, 'view'")
          .replace(/IndexPage\.prototype\.navItems/g, 'IndexSidebar.prototype.navItems')
          .replace("IndexPage.prototype, 'navItems'", "IndexSidebar.prototype, 'navItems'")
          .replace(/IndexPage\.prototype\.currentTag/g, 'app.currentTag'),
      };
    };
  }

  private updateAvatarIcon(): Replacement {
    return (file, code, advanced) => {
      const imports: ImportChange[] = [];

      if (code.includes('flarum/common/helpers/avatar')) {
        imports.push({
          replacesPath: 'flarum/common/helpers/avatar',
          import: {
            name: 'Avatar',
            defaultImport: true,
            path: 'flarum/common/components/Avatar',
          },
        });
      }

      if (code.includes('flarum/common/helpers/icon')) {
        imports.push({
          replacesPath: 'flarum/common/helpers/icon',
          import: {
            name: 'Icon',
            defaultImport: true,
            path: 'flarum/common/components/Icon',
          },
        });
      }

      if (imports.length === 0) return null;

      const ast = advanced as t.File;

      const noJsx = /\bm\(\s*["']/gs.test(code);
      const jsx = !noJsx; // /<\/\w+>/gs.test(code);

      traverse(ast, {
        CallExpression(path) {
          const node = path.node;
          const funcName = getFunctionName(node.callee);
          const args = node.arguments;

          if (['avatar', 'icon'].includes(funcName || '')) {
            const userOrName = args[0];
            const attrs = args[1];

            if (!t.isExpression(userOrName) && !t.isStringLiteral(userOrName)) {
              console.warn(`Unknown userOrName type for ${funcName} in ${file}: ${userOrName.type}`);
              return;
            }

            const tag = funcName === 'avatar' ? 'Avatar' : 'Icon';
            const mainArgName = funcName === 'avatar' ? 'user' : 'name';

            if (jsx) {
              let attrsToJsx = null;

              if (attrs && t.isObjectExpression(attrs)) {
                attrsToJsx = (attrs as t.ObjectExpression).properties
                  .filter((prop) => t.isObjectProperty(prop) && !t.isArrayPattern(prop.value))
                  .map((prop) => {
                    prop = prop as t.ObjectProperty;

                    const key = 'value' in prop.key ? prop.key.value : 'name' in prop.key ? prop.key.name : prop.key.type;

                    if (t.isArrayPattern(prop.value) || t.isObjectPattern(prop.value) || t.isRestElement(prop.value)) {
                      console.warn('Failed to convert to JSX:', { [key.toString()]: prop.value });
                      return null;
                    }

                    if (t.isAssignmentPattern(prop.value)) {
                      return t.jsxAttribute(
                        t.jsxIdentifier(key.toString()),
                        t.isStringLiteral(prop.value.right) ? prop.value.right : t.jsxExpressionContainer(prop.value.right)
                      );
                    }

                    try {
                      return t.jsxAttribute(
                        t.jsxIdentifier(key.toString()),
                        t.isStringLiteral(prop.value) ? prop.value : t.jsxExpressionContainer(prop.value)
                      );
                    } catch (error) {
                      throw new Error(`Could not turn the "${key.toString()}" attr into a JSX attribute: ${(error as Error).message}`);
                    }
                  }) as t.JSXAttribute[];
              } else if (attrs && t.isIdentifier(attrs)) {
                attrsToJsx = [t.jsxSpreadAttribute(attrs)];
              } else if (attrs) {
                console.warn(`Unknown attrs type for ${funcName} in ${file}: ${attrs.type}`);
              }

              const mainArg = t.jsxAttribute(
                t.jsxIdentifier(mainArgName),
                t.isStringLiteral(userOrName) ? userOrName : t.jsxExpressionContainer(userOrName)
              );

              const jsxElem = t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(tag), [mainArg, ...(attrsToJsx || [])], true), null, [], true);

              // If the node is enclosed in { ... }, remove them
              if (t.isJSXExpressionContainer(path.parent)) {
                path.parentPath.replaceWith(jsxElem);
              } else {
                path.replaceWith(jsxElem);
              }
            } else {
              // Avatar.component({ ... })
              // Icon.component({ ... })

              const mainArg = t.objectProperty(t.identifier(mainArgName), userOrName);
              let otherAttrs = attrs && t.isObjectExpression(attrs) ? (attrs as t.ObjectExpression).properties : [];

              if (attrs && t.isSpreadElement(attrs)) {
                otherAttrs = [t.spreadElement(attrs.argument)];
              }

              const component = t.callExpression(t.memberExpression(t.identifier(tag), t.identifier('component')), [
                t.objectExpression([mainArg, ...otherAttrs]),
              ]);

              path.replaceWith(component);
            }
          }
        },
      });

      return {
        imports,
        updated: ast,
      };
    };
  }

  private updateOtherRefs(): Replacement {
    return (_file, code) => {
      if (code.includes("extend(Search.prototype, 'sourceItems'")) {
        code = code
          .replace(/SearchSource/g, 'GlobalSearchSource')
          .replace('flarum/forum/components/Search', 'flarum/common/components/GlobalSearch')
          .replace('import Search from ', 'import GlobalSearch from ')
          .replace('import Search,', 'import GlobalSearch,')
          .replace(/Search.prototype/g, 'GlobalSearch.prototype');
      }

      return {
        updated: code
          .replace(/this\.currentTag/g, 'app.currentTag')
          .replace('app.search.', 'app.search.state.')
          .replace(/\bapp\.extensionData\b/g, 'app.registry')
          .replace(/\b(app\.registry\s*\.\s*)getAllExtensionPermissions\b/g, '$1getAllPermissions')
          .replace("extend(BasicsPage.prototype, 'homePageItems'", "extend(BasicsPage, 'homePageItems'")
          .replace('className="NotificationList', 'className="HeaderList')
          .replace('className: "NotificationList', 'className: "HeaderList')
          .replace('className="NotificationGroup', 'className="HeaderListGroup')
          .replace('className: "NotificationGroup', 'className: "HeaderListGroup')
          .replace('flarum/forum/states/SearchState', 'flarum/common/states/SearchState'),
      };
    };
  }

  /**
   * `app.initializers.has(name)` becomes `'id' in flarum.extensions`, where the
   * upgrade knows the ID for certain: a bundled extension's, or one the
   * extension's composer.json names. An initializer is not always named after
   * its extension, so a check it can't be sure of gets a @TODO instead.
   */
  private updateInitializers(): Replacement {
    return (_file, code) => {
      if (!/initializers\s*\.\s*has\s*\(/.test(code)) return null;

      const edits: Array<{ start: number; end: number; text: string }> = [];
      const flagged = new Set<number>();

      traverse(parse(code) as t.File, {
        CallExpression: (p) => {
          const id = this.checkedExtension(p.node);

          if (id === undefined) return;

          if (id) {
            edits.push({ start: p.node.start!, end: p.node.end!, text: `('${id}' in flarum.extensions)` });

            return;
          }

          // Above the statement, where a comment can't land in JSX or a string.
          const statement = p.getStatementParent();

          if (!statement || statement.node.leadingComments?.some((comment) => comment.value.includes(CHECK_TODO))) return;

          const lineStart = code.lastIndexOf('\n', statement.node.start! - 1) + 1;

          if (flagged.has(lineStart)) return;

          flagged.add(lineStart);

          const indent = /^[\t ]*/.exec(code.slice(lineStart))![0];
          const docs = 'https://docs.flarum.org/2.x/extend/extending-extensions';

          edits.push({
            start: lineStart,
            end: lineStart,
            text: `${indent}// ${CHECK_TODO} (${docs}). An initializer is not always named after its extension, and some were renamed in 2.0.\n`,
          });
        },
      });

      if (edits.length === 0) return null;

      return {
        updated: edits
          .sort((a, b) => b.start - a.start)
          .reduce((result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end), code),
      };
    };
  }

  /**
   * For `app.initializers.has('name')`: the ID of the extension it checks for,
   * or null when the upgrade can't be sure of it. Undefined for anything else.
   */
  private checkedExtension(call: t.CallExpression): string | null | undefined {
    const callee = call.callee;

    if (!t.isMemberExpression(callee) || callee.computed || !t.isIdentifier(callee.property, { name: 'has' })) return undefined;

    const initializers = callee.object;

    if (!t.isMemberExpression(initializers) || initializers.computed || !t.isIdentifier(initializers.property, { name: 'initializers' })) {
      return undefined;
    }

    const owner = initializers.object;

    if (!t.isIdentifier(owner, { name: 'app' }) && !(t.isMemberExpression(owner) && t.isIdentifier(owner.property, { name: 'app' }))) {
      return undefined;
    }

    const [name] = call.arguments;

    if (call.arguments.length !== 1 || !t.isStringLiteral(name)) return undefined;

    return RENAMED[name.value] ?? (BUNDLED.has(name.value) ? name.value : this.namedExtensions().get(name.value) ?? null);
  }

  private named: Map<string, string> | null = null;

  /**
   * The extensions the composer.json names, by package name and by ID.
   */
  private namedExtensions(): Map<string, string> {
    if (this.named) return this.named;

    this.named = new Map();

    let composer: Record<string, any> = {};

    try {
      composer = JSON.parse(fs.readFileSync(path.join(this.root, 'composer.json'), 'utf8'));
    } catch {
      return this.named;
    }

    const packages = [
      ...Object.keys(composer.require ?? {}),
      ...Object.keys(composer['require-dev'] ?? {}),
      ...Object.keys(composer.suggest ?? {}),
      ...(composer.extra?.['flarum-extension']?.['optional-dependencies'] ?? []),
    ].filter((name: unknown): name is string => typeof name === 'string' && name.includes('/'));

    for (const name of packages) {
      this.named.set(name, extensionId(name));
      this.named.set(extensionId(name), extensionId(name));
    }

    return this.named;
  }

  private updateUploadImageButton(): Replacement {
    return (file, code) => {
      if (!code.includes('UploadImageButton')) return null;

      return {
        updated: code
          // /admin => /common
          .replace(/flarum\/admin\/components\/UploadImageButton/g, 'flarum/common/components/UploadImageButton')
          .replace(/flarum\/components\/UploadImageButton/g, 'flarum/common/components/UploadImageButton')
          // <UploadImageButton name="favicon" />
          // =>
          // <UploadImageButton name="favicon" routePath="favicon" value={app.data.settings.favicon_path} url={app.forum.attribute('faviconUrl')} />
          .replace(
            /<UploadImageButton\s+name="([\dA-z-]+)"\s*/g,
            '<UploadImageButton name="$1" routePath="$1" value={app.data.settings[\'$1_path\']} url={app.forum.attribute(\'$1Url\')}'
          )
          // UploadImageButton.component({
          //   name: 'fof-watermark',
          //   ...
          // }),
          // =>
          // UploadImageButton.component({
          //   name: 'fof-watermark',
          //   routePath: 'fof-watermark',
          //   value: app.data.settings['fof-watermark_path'],
          //   url: app.forum.attribute('fof-watermarkUrl'),
          //   ...
          // }),
          .replace(/UploadImageButton\.component\(\s*{([^}]+),?\s*}\s*\)/g, (_match, attrs) => {
            const name = attrs.match(/name: ["']([^"']+)["'],?/)?.[1];

            // remove ,
            attrs = attrs.replace(/,\s*$/, '');

            return `UploadImageButton.component({${attrs}, routePath: '${name}', value: app.data.settings['${name}_path'], url: app.forum.attribute('${name}Url')})`;
          }),
      };
    };
  }

  private updateExtendModal(): Replacement[] {
    return [
      (file, code, advanced) => {
        if (!file.endsWith('.tsx') && !file.endsWith('.jsx') && !file.endsWith('.js') && !file.endsWith('.ts')) return null;

        if (!code.includes(' extends Modal') || !code.includes('flarum/common/components/Modal')) return null;

        // eslint-disable-next-line prefer-regex-literals
        if (!new RegExp('<input\\s').test(code) && !code.includes(' onsubmit(')) return null;

        const ast = advanced as t.File;

        // Change extends Modal to extends FormModal
        traverse(ast, {
          ClassDeclaration(path) {
            const node = path.node;

            if (node.superClass && t.isIdentifier(node.superClass) && node.superClass.name === 'Modal') {
              node.superClass = t.identifier('FormModal');
            }
          },
        });

        return {
          imports: [
            {
              replacesPath: 'flarum/common/components/Modal',
              import: {
                name: 'FormModal',
                defaultImport: true,
                path: 'flarum/common/components/FormModal',
              },
            },
          ],
          updated: advanced,
        };
      },

      (file, code) => {
        if (!file.endsWith('.tsx') && !file.endsWith('.jsx') && !file.endsWith('.js') && !file.endsWith('.ts')) return null;

        if (!code.includes('extends FormModal')) return null;

        if (!code.includes('IInternalModalAttrs')) return null;

        return {
          imports: [
            {
              replacesPath: 'flarum/common/components/Modal',
              import: {
                name: 'IFormModalAttrs',
                defaultImport: false,
                path: 'flarum/common/components/FormModal',
              },
            },
          ],
          updated: code.replace(/IInternalModalAttrs/g, 'IFormModalAttrs'),
        };
      },
    ];
  }
}
