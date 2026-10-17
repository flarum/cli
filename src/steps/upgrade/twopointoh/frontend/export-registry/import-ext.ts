import * as t from '@babel/types';
import { BaseUpgradeStep, GitCommit, Replacement } from '../../base';
import chalk from 'chalk';

export default class ImportExt extends BaseUpgradeStep {
  type = 'Replace import paths when importing from extensions.';

  private importingFromExtensions: string[] = [];
  private useExtensions: string[] = [];

  replacements(file: string): Replacement[] {
    if (file.endsWith('webpack.config.js') || file.endsWith('webpack.config.cjs')) {
      return [this.removeUseExtensionsOption()];
    }

    if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.jsx')) {
      return [this.updateImportsFromFlarumExtensions()];
    }

    if (file.endsWith('tsconfig.json')) {
      return [this.updateTsConfigPaths()];
    }

    return [];
  }

  targets(): string[] {
    return ['js/webpack.config.js', 'js/webpack.config.cjs', 'js/src/**/*', 'js/tsconfig.json'];
  }

  gitCommit(): GitCommit {
    return {
      message: 'chore(2.0): use new import from extension format',
      description: 'Importing modules from an extension can now be done though `ext:vendor/extension/module-path` format.',
    };
  }

  pauseMessage(): string {
    const useExtensions = chalk.bgYellow.bold('useExtensions');
    const format = chalk.bgCyan.bold('ext:vendor/extension/module-path');
    const exampleImport = chalk.bgCyan.bold("import Tag from 'ext:flarum/tags/common/models/Tag';");
    const example = chalk.dim(`For example: ${exampleImport} (Documentation: https://docs.flarum.org/2.x/extend/registry)`);

    return `The format of importing from extensions has changed. The webpack config's ${useExtensions} option has been removed.
                     The tool cannot recognize imports from other extensions, you must manually update them.
                     You can import from an extension using the ${format} format.
                     ${example}`;
  }

  removeUseExtensionsOption(): Replacement {
    return (_file, _code, advanced) => {
      const ast = advanced as t.File;

      if (!ast) return null;

      // module.exports = require('flarum-webpack-config')({
      //   useExtensions: ['fof-user-directory'],
      // });

      const webpackConfig = ast as t.File;

      const node = webpackConfig.program.body.find(
        (node) => t.isExpressionStatement(node) && t.isAssignmentExpression(node.expression)
      ) as t.ExpressionStatement;

      if (!node) return null;

      const assignment = node.expression as t.AssignmentExpression;

      if (!t.isCallExpression(assignment.right)) return null;

      const call = assignment.right as t.CallExpression;

      const firstArg = call.arguments[0] ?? null;

      if (!firstArg || !t.isObjectExpression(firstArg)) return null;

      const properties = firstArg.properties as t.ObjectProperty[];

      properties.forEach((prop, index) => {
        if (t.isIdentifier(prop.key) && prop.key.name === 'useExtensions') {
          this.useExtensions = (prop.value as t.ArrayExpression).elements.map((el) => (el as t.StringLiteral).value);
          delete properties[index];
        }
      });

      return {
        updated: ast,
      };
    };
  }

  updateImportsFromFlarumExtensions(): Replacement {
    return (_file, code) => {
      // replace `import module from 'flarum/ext/module-path';` with `import module from 'ext:flarum/extension/module-path';`
      // wherever the code names a module: in imports and exports of any kind, import(), require(),
      // and `declare module`, which augments the module. extension must not be one of [forum, admin, common].
      const regex =
        /(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bdeclare\s+module\s+|\bimport\s+)(["'])(flarum\/(?!\b(?:common|admin|forum|utils|helpers|components|models)\b)[\w-]+\/[^\s"']+)\2/gm;

      // First collect all the extensions imported from
      for (const match of code.matchAll(regex)) {
        this.importingFromExtensions.push(match[3].split('/').slice(0, 2).join('/'));
      }

      // add todos to update imports that use other extensions
      const uniqueUseExtensions = [...new Set(this.useExtensions)];
      uniqueUseExtensions.forEach((ext) => {
        code = code.replace(new RegExp(`(^.*['|"]@${ext}['|"].*$)`, 'gim'), '$1 // @TODO: import from `ext:vendor/extension/module-path` format.');
      });

      return {
        updated: code
          .replace(regex, '$1$2ext:$3$2')
          // imports from @flarum/core no longer supported, replace with flarum/
          .replace(/import\s+(\w+)\s+from\s+["']@flarum\/core\/([\w/]+)["']/gim, `import $1 from 'flarum/$2'`),
      };
    };
  }

  updateTsConfigPaths(): Replacement {
    return (_file, code, advanced) => {
      advanced = advanced as Record<string, any>;

      const uniqueExtensions = [...new Set(this.importingFromExtensions)];

      if (uniqueExtensions.length === 0) return null;

      advanced.compilerOptions.paths ||= {};

      const paths = advanced.compilerOptions.paths;

      uniqueExtensions.forEach((ext) => {
        // Where the 1.x mapping found the typings, which isn't always vendor.
        const typings = paths[`${ext}/*`];

        delete paths[ext];
        delete paths[`${ext}/*`];

        paths[`ext:${ext}/*`] ||= typings ?? [`../vendor/${ext}/js/dist-typings/*`];
      });

      return {
        updated: advanced,
      };
    };
  }
}
