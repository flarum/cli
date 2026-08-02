import { BaseUpgradeStep, GitCommit, Replacement } from '../base';
import chalk from 'chalk';
import { modernizePhpunitXml } from './phpunit-xml';

export default class PhpUnit extends BaseUpgradeStep {
  type = 'PHPUnit 9 to 11 changes';

  replacements(file: string): Replacement[] {
    if (file.endsWith('.php')) {
      return [
        (_file, code) => ({
          updated: this.php!.run('upgrade.2-0.phpunit', { file, code }).code,
        }),
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
      message: 'chore(2.0): Backend tests + PHPUnit 9 to 11 changes',
      description: 'Flarum 2.0 uses PHPUnit 11 and encourages use of model factories for easier cross-database testing.',
    };
  }

  pauseMessage(): string {
    const links = [
      'https://github.com/sebastianbergmann/phpunit/blob/9.6/DEPRECATIONS.md',
      'https://github.com/sebastianbergmann/phpunit/blob/10.5/DEPRECATIONS.md',
      'https://github.com/sebastianbergmann/phpunit/blob/11.3.0/DEPRECATIONS.md',
    ];

    const dbLink = 'https://docs.flarum.org/2.x/extend/testing#model-factories';

    return `Flarum 2.0 uses PHPUnit 11. The tool has applied the most significant changes, but you might still run into other deprecations.
                     Please refer to the following links for more information:
                     ${links.map((link) => chalk.underline(link)).join('\n                     ')}

                     Additionally, Flarum 2.0 encourages the use of model factories when preparing data for tests, this simplifies cross-database testing
                     as PgSQL and SQLite are more strict about constraints.
                     ${chalk.underline(dbLink)}`;
  }
}
