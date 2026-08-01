import { BaseUpgradeStep, GitCommit, Replacement } from '../base';
import chalk from 'chalk';

export default class PhpUnit extends BaseUpgradeStep {
  type = 'PHPUnit 9 to 11 changes';

  replacements(file: string): Replacement[] {
    if (!file.endsWith('.php')) return [];

    return [
      (_file, code) => ({
        updated: this.php!.run('upgrade.2-0.phpunit', { file, code }).code,
      }),
      (file, code) => {
        if (!file.endsWith('.xml')) return null;

        return {
          updated: code.replace('xsi:noNamespaceSchemaLocation="([^"]+)"', 'xsi:noNamespaceSchemaLocation="../vendor/phpunit/phpunit/phpunit.xsd"'),
        };
      },
    ];
  }

  targets(): string[] {
    return ['tests/**/*'];
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
