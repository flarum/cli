import { BaseUpgradeStep, GitCommit, Replacement } from './base';
import chalk from 'chalk';

export default class Dependencies extends BaseUpgradeStep {
  type = 'Update the extension dependencies to the latest versions.';

  replacements(file: string): Replacement[] {
    const replacements: Replacement[] = [];

    switch (file) {
      case 'composer.json':
        replacements.push(this.updateComposerJson());
        break;
      case 'js/package.json':
        replacements.push(this.updatePackageJson());
    }

    return replacements;
  }

  targets(): string[] {
    return ['composer.json', 'js/package.json'];
  }

  gitCommit(): GitCommit {
    return {
      message: 'chore(2.0): update dependencies',
      description: 'Update dependencies to Flarum 2.0 compatible versions.',
    };
  }

  pauseMessage(): string {
    const composerInstall = chalk.bgYellowBright('composer install');
    const composerUpdate = chalk.bgYellowBright('composer update');
    const yarn = chalk.bgYellowBright('yarn');
    const npm = chalk.bgYellowBright('npm install');

    return `Dependencies updated. Please review the changes and update any other dependency versions as needed.
                     It is recommended to run ${composerInstall} or ${composerUpdate} and ${yarn} or ${npm} now.
                     But you may also leave that until the upgrade process is over.`;
  }

  updateComposerJson(): Replacement {
    return (_file, _code, advanced) => {
      const composer = advanced as Record<string, any>;

      const moves = {
        'blomstra/gdpr': 'flarum/gdpr',
      };

      for (let [key, value] of Object.entries(composer.require || {})) {
        Object.entries(moves).forEach(([from, to]) => {
          if (key === from) {
            composer.require[to] = value;
            delete composer.require[key];
            key = to;
          }
        });

        if (key === 'flarum/core') {
          composer.require[key] = '^2.0.0';
        } else if (key.startsWith('flarum/') && value !== '*') {
          composer.require[key] = '*';
        }
      }

      for (let [key, value] of Object.entries(composer['require-dev'] || {})) {
        Object.entries(moves).forEach(([from, to]) => {
          if (key === from) {
            composer['require-dev'][to] = value;
            delete composer['require-dev'][key];
            key = to;
          }
        });

        if (['flarum/core', 'flarum/testing', 'flarum/phpstan'].includes(key)) {
          composer['require-dev'][key] = '^2.0.0';
        } else if (key.startsWith('flarum/') && (value as string).startsWith('^1')) {
          composer['require-dev'][key] = '*';
        }
      }

      if (composer.require.php) {
        composer.require.php = '^8.3';
      }

      // Flarum 2.0 is stable, so its constraints resolve without changing the
      // extension's minimum stability.

      if (composer.require['fof/extend']) {
        composer.require['fof/extend'] = '^2.0.0';
      }

      return {
        updated: composer,
      };
    };
  }

  updatePackageJson(): Replacement {
    return (_file, _code, advanced) => {
      advanced = advanced as Record<string, any>;

      // The versions a new extension is scaffolded with. 3.0.6 is the first
      // flarum-webpack-config that loads an extension's code-split chunks from
      // its own build.
      const map: Record<string, string> = {
        'flarum-webpack-config': '^3.0.6',
        'flarum-tsconfig': '^2.0.0',
        '@flarum/jest-config': '^2.0.0',
        webpack: '^5.104.1',
        'webpack-cli': '^4.9.1',
      };

      // Extensions list the tooling under either key, often split between both.
      for (const dependencies of [advanced.dependencies, advanced.devDependencies]) {
        for (const key of Object.keys(dependencies || {})) {
          if (map[key]) {
            dependencies[key] = map[key];
          }
        }
      }

      // Remove duplicates from devDependencies
      if (advanced.dependencies && advanced.devDependencies) {
        for (const [key] of Object.entries(advanced.dependencies)) {
          if (advanced.devDependencies[key]) {
            delete advanced.devDependencies[key];
          }
        }
      }

      return {
        updated: advanced,
      };
    };
  }
}
