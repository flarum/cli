import { AdvancedContent, BaseUpgradeStep, GitCommit, Replacement } from './base';
import chalk from 'chalk';
import { compilerOptions, libs } from './typescript-4-9';

// What `fl init` gave 1.x extensions. `sed -i` with no suffix is GNU sed's
// form: BSD sed, as on macOS, takes the next argument as the suffix and fails.
// With the suffix attached, both work.
const GNU_POST_BUILD_TYPINGS = "find dist-typings -type f -name '*.d.ts' -print0 | xargs -0 sed -i 's,../src/@types,@types,g'";
const PORTABLE_POST_BUILD_TYPINGS =
  "find dist-typings -type f -name '*.d.ts' -print0 | xargs -0 sed -i.bak 's,../src/@types,@types,g' && find dist-typings -type f -name '*.d.ts.bak' -delete";

// Syntax TypeScript 4.9 can't compile, each checked against typescript@4.9.5.
const NEWER_SYNTAX: [RegExp, string][] = [
  [/(?:\bfrom|^\s*import)\s+(["'])[^\n"']*\1\s+with\s*{/, 'import attributes (TypeScript 5.3); use `assert` instead of `with`'],
  [/^\s*export\s+type\s+\*/, '`export type *` (TypeScript 5.0)'],
  [/[,<]\s*const\s+[$A-Z_a-z][\w$]*\s*(?:extends\b|[,=>])/, '`const` type parameters (TypeScript 5.0)'],
  [/^\s*(?:await\s+)?using\s+[$A-Z_a-z][\w$]*\s*[:=]/, '`using` declarations (TypeScript 5.2)'],
];

const isTypeScript = (file: string) => /\.tsx?$/.test(file);

/** Whether a version constraint stays within TypeScript 4: `4.9.5`, `^4.5.4`, `~4.7`, `4.x`. */
const isFourX = (constraint: string) => {
  const version = constraint.trim().replace(/^\^|^~/, '');

  return version === '4' || version.startsWith('4.');
};

export default class Dependencies extends BaseUpgradeStep {
  type = 'Update the extension dependencies to the latest versions.';

  /** The TypeScript the extension asked for, when it was not a 4.x. */
  protected typeScriptWas: string | null = null;

  /** What was removed from tsconfig.json, as TypeScript 4.9 doesn't have it. */
  protected removedCompilerOptions: string[] = [];

  protected extendsList = false;

  protected newerSyntax = false;

  replacements(file: string): Replacement[] {
    const replacements: Replacement[] = [];

    switch (file) {
      case 'composer.json':
        replacements.push(this.updateComposerJson());
        break;
      case 'js/package.json':
        replacements.push(this.updatePackageJson());
        break;
      case 'js/tsconfig.json':
        replacements.push(this.updateTsConfig());
        break;
      default:
        if (isTypeScript(file)) {
          replacements.push(this.flagNewerSyntax());
        }
    }

    return replacements;
  }

  targets(): string[] {
    return ['composer.json', 'js/package.json', 'js/tsconfig.json', 'js/src/**/*.ts', 'js/src/**/*.tsx'];
  }

  // TypeScript sources are only searched, line by line: parsing them would
  // fail on the very syntax being looked for, and reformatting would change
  // more than the lines flagged.
  advancedContent(file: string, code: string): AdvancedContent {
    return isTypeScript(file) ? null : super.advancedContent(file, code);
  }

  async updateCode(file: string, code: string, updated: string | AdvancedContent): Promise<string> {
    return isTypeScript(file) && typeof updated === 'string' ? updated : super.updateCode(file, code, updated);
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

    const notes = [
      this.typeScriptWas &&
        `TypeScript ${this.typeScriptWas} was brought down to ^4.9.5: Flarum 2.0 builds and checks its typings with TypeScript 4.9.`,
      this.removedCompilerOptions.length > 0 &&
        `Removed from js/tsconfig.json, as TypeScript 4.9 does not have them: ${this.removedCompilerOptions.join(', ')}.`,
      this.extendsList && 'js/tsconfig.json extends a list of configs, which TypeScript 4.9 cannot read. Extend one, and move the rest into it.',
      this.newerSyntax && 'Some TypeScript uses syntax 4.9 cannot compile; look for the @TODO comments.',
    ].filter(Boolean);

    return [
      'Dependencies updated. Please review the changes and update any other dependency versions as needed.',
      ...notes,
      `It is recommended to run ${composerInstall} or ${composerUpdate} and ${yarn} or ${npm} now.`,
      'But you may also leave that until the upgrade process is over.',
    ].join('\n                     ');
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
        // What Flarum 2.0 builds and checks its typings with.
        typescript: '^4.9.5',
      };

      // Extensions list the tooling under either key, often split between both.
      for (const dependencies of [advanced.dependencies, advanced.devDependencies]) {
        for (const key of Object.keys(dependencies || {})) {
          if (key === 'typescript' && !isFourX(String(dependencies[key]))) {
            this.typeScriptWas = dependencies[key];
          }

          if (map[key]) {
            dependencies[key] = map[key];
          }
        }
      }

      if (advanced.scripts?.['post-build-typings'] === GNU_POST_BUILD_TYPINGS) {
        advanced.scripts['post-build-typings'] = PORTABLE_POST_BUILD_TYPINGS;
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

  /**
   * Drop the compiler options, and option values, TypeScript 4.9 doesn't have:
   * it refuses a tsconfig.json with any. A tsconfig.json it can read is left
   * exactly as it was.
   */
  updateTsConfig(): Replacement {
    return (_file, _code, advanced) => {
      const tsconfig = advanced as Record<string, any>;
      const options: Record<string, unknown> = tsconfig.compilerOptions || {};
      const removed: string[] = [];

      for (const [name, value] of Object.entries(options)) {
        const known = Object.prototype.hasOwnProperty.call(compilerOptions, name) ? compilerOptions[name] : null;

        if (!known) {
          removed.push(name);
          delete options[name];
        } else if (name === 'lib' && Array.isArray(value)) {
          const kept = value.filter((lib) => typeof lib === 'string' && libs.includes(lib.toLowerCase()));

          for (const lib of value.filter((lib) => !kept.includes(lib))) {
            removed.push(`lib "${lib}"`);
          }

          if (kept.length === 0) {
            delete options.lib;
          } else if (kept.length < value.length) {
            options.lib = kept;
          }
        } else if (Array.isArray(known) && typeof value === 'string' && !known.includes(value.toLowerCase())) {
          removed.push(`${name} "${value}"`);
          delete options[name];
        }
      }

      this.extendsList = this.extendsList || Array.isArray(tsconfig.extends);
      this.removedCompilerOptions.push(...removed);

      return removed.length > 0 ? { updated: tsconfig } : null;
    };
  }

  /**
   * Put a @TODO above each line using syntax TypeScript 4.9 can't compile.
   */
  flagNewerSyntax(): Replacement {
    return (_file, code) => {
      const flagged: string[] = [];

      for (const line of code.split('\n')) {
        for (const [pattern, what] of NEWER_SYNTAX) {
          if (!pattern.test(line)) continue;

          const indent = line.slice(0, line.length - line.trimStart().length);
          const todo = `${indent}// @TODO: Flarum 2.0 builds with TypeScript 4.9, which has no ${what}.`;

          // An earlier run already flagged it.
          if (flagged.slice(-NEWER_SYNTAX.length).some((previous) => previous.trim() === todo.trim())) continue;

          flagged.push(line.endsWith('\r') ? `${todo}\r` : todo);
          this.newerSyntax = true;
        }

        flagged.push(line);
      }

      const updated = flagged.join('\n');

      return updated === code ? null : { updated };
    };
  }
}
