import { BaseUpgradeStep, GitCommit, Replacement } from '../base';
import chalk from 'chalk';
import { modernizePhpunitXml } from './phpunit-xml';
import { extensionModels } from './extension-models';

export default class PhpUnit extends BaseUpgradeStep {
  type = 'PHPUnit 9 to 12 changes';

  /** Core's models and the extension's, by table, for prepareDatabase() to name. */
  private models: Record<string, string> | null = null;

  replacements(file: string): Replacement[] {
    if (file.endsWith('.php')) {
      return [
        (_file, code) => {
          this.models ??= extensionModels(this.root, this.php!).byTable;

          return {
            updated: this.php!.run('upgrade.2-0.phpunit', { file, code, data: { models: this.models } }).code,
          };
        },
      ];
    }

    // The XML rewrite previously sat behind the .php guard above (making it
    // unreachable) and used String.replace with regex syntax in a string
    // (matching nothing) — every upgraded extension kept its 9.3-era config.
    if (/(^|\/)phpunit(\.[\w-]+)?\.xml$/.test(file)) {
      return [
        (xmlFile, code) => ({
          updated: modernizePhpunitXml(xmlFile, code),
        }),
      ];
    }

    return [];
  }

  targets(): string[] {
    return ['tests/**/*', 'phpunit.xml', 'phpunit.*.xml'];
  }

  gitCommit(): GitCommit {
    return {
      message: 'chore(2.0): Backend tests + PHPUnit 9 to 12 changes',
      description: 'Flarum 2.0 uses PHPUnit 12 and encourages use of model factories for easier cross-database testing.',
    };
  }

  pauseMessage(): string {
    const links = [
      'https://github.com/sebastianbergmann/phpunit/blob/9.6/DEPRECATIONS.md',
      'https://github.com/sebastianbergmann/phpunit/blob/10.5/DEPRECATIONS.md',
      'https://github.com/sebastianbergmann/phpunit/blob/11.5/DEPRECATIONS.md',
      'https://github.com/sebastianbergmann/phpunit/blob/12.5/DEPRECATIONS.md',
    ];

    const dbLink = 'https://docs.flarum.org/2.x/extend/testing#model-factories';

    return `Flarum 2.0 uses PHPUnit 12. The tool has applied the most significant changes, and left @TODO comments on what it could not, but you might still run into other deprecations.
                     Please refer to the following links for more information:
                     ${links.map((link) => chalk.underline(link)).join('\n                     ')}

                     Additionally, Flarum 2.0 encourages the use of model factories when preparing data for tests, this simplifies cross-database testing
                     as PgSQL and SQLite are more strict about constraints.
                     ${chalk.underline(dbLink)}`;
  }
}
