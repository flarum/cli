import { BaseUpgradeStep, GitCommit, Replacement } from './base';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { compilerOptions, libs } from './typescript-5-9';

// What `fl init` gave 1.x extensions. `sed -i` with no suffix is GNU sed's
// form: BSD sed, as on macOS, takes the next argument as the suffix and fails.
// With the suffix attached, both work.
const GNU_POST_BUILD_TYPINGS = "find dist-typings -type f -name '*.d.ts' -print0 | xargs -0 sed -i 's,../src/@types,@types,g'";
const PORTABLE_POST_BUILD_TYPINGS =
  "find dist-typings -type f -name '*.d.ts' -print0 | xargs -0 sed -i.bak 's,../src/@types,@types,g' && find dist-typings -type f -name '*.d.ts.bak' -delete";

// Packages an extension only needs to build, check and test its frontend.
const BUILD_TOOLING = new Set([
  '@flarum/jest-config',
  '@flarum/prettier-config',
  'flarum-tsconfig',
  'flarum-webpack-config',
  'prettier',
  'typescript',
  'typescript-coverage-report',
  'webpack',
  'webpack-cli',
]);

// The scripts that build and check an extension's typings, as the reusable
// frontend workflow runs them.
const TYPINGS_SCRIPTS = ['clean-typings', 'build-typings', 'post-build-typings', 'check-typings', 'check-typings-coverage'];

// What those scripts run.
const TYPINGS_TOOLING = ['typescript', 'typescript-coverage-report'];

/** The package.json `fl init` gives a new extension, for the given package manager. */
function scaffoldedPackageJson(packageManager: 'yarn' | 'npm'): Record<string, any> {
  const skeleton = fs.readFileSync(path.resolve(__dirname, '../../../../boilerplate/skeleton/extension/js/package.json'), 'utf8');

  // EJS placeholders only appear inside strings, so it parses as JSON.
  return JSON.parse(skeleton.replace(/<%= params\.jsPackageManager %>/g, packageManager));
}

const TYPES_COMMENT = [
  'Only load the type packages the code imports, not every one in',
  'node_modules, such as the @types/node webpack brings along.',
];

/**
 * The tsconfig.json with an option first in its compilerOptions, and the
 * comment lines above it, indented as the options there are. Null when it has
 * no compilerOptions to put it in.
 */
function insertCompilerOption(code: string, comment: string[] | null, option: string): string | null {
  const open = code.match(/"compilerOptions"\s*:\s*{/);

  if (!open) return null;

  const at = open.index! + open[0].length;
  const eol = code.includes('\r\n') ? '\r\n' : '\n';
  const next = code.slice(at).match(/\r?\n([\t ]*)\S/);
  const indent = next?.[1] ?? '    ';
  const lines = [...(comment ?? []).map((line) => `// ${line}`), `${option},`];

  return code.slice(0, at) + lines.map((line) => eol + indent + line).join('') + code.slice(at);
}

/** Dependencies in the alphabetical order package managers keep them in. */
const sortedByName = (dependencies: Record<string, string>) =>
  Object.fromEntries(Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)));

/**
 * Whether a TypeScript constraint could resolve to TypeScript 6 or newer:
 * `^6.0.3`, `>=4.2`, `latest`, `*`. A caret, tilde or exact constraint on 4 or
 * 5 can't.
 */
const allowsSixOrNewer = (constraint: string) => {
  const match = constraint.trim().match(/^[=^~]?\s*v?(\d+)(?:\.|$)/);

  return !match || Number(match[1]) >= 6;
};

/**
 * The lowest version a simple constraint allows, as [major, minor, patch]:
 * `^5.1.4`, `~4.7`, `>=8.3`, `5.x`. Null for anything else, such as `*`, a
 * range with `||` or a prerelease.
 */
const lowestVersion = (constraint: string): number[] | null => {
  const match = constraint.trim().match(/^(?:\^|~|>=|=)?\s*v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/);

  return match ? match.slice(1).map((part) => (part && /^\d+$/.test(part) ? Number(part) : 0)) : null;
};

/** Whether a constraint asks for a newer version than another does. */
const asksForNewer = (constraint: string, than: string): boolean => {
  const asked = lowestVersion(constraint);
  const other = lowestVersion(than);

  if (!asked || !other) return false;

  const differs = asked.findIndex((part, i) => part !== other[i]);

  return differs !== -1 && asked[differs] > other[differs];
};

export default class Dependencies extends BaseUpgradeStep {
  type = 'Update the extension dependencies to the latest versions.';

  /** The TypeScript the extension asked for, when it allowed TypeScript 6 or newer. */
  protected typeScriptWas: string | null = null;

  /** What was removed from tsconfig.json, as TypeScript 5.9 refuses it. */
  protected removedCompilerOptions: string[] = [];

  /** Constraints left as they were, as they already ask for newer versions. */
  protected keptNewer: string[] = [];

  /** Tooling moved from dependencies to devDependencies. */
  protected movedToDev: string[] = [];

  /** The typings scripts, and the tooling they run, added to package.json. */
  protected addedTypings: string[] = [];

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
        replacements.push(this.updateTsConfig(), this.limitTypes());
        break;
      case 'js/tsconfig.test.json':
        replacements.push(this.testTypes());
        break;
    }

    return replacements;
  }

  targets(): string[] {
    return ['composer.json', 'js/package.json', 'js/tsconfig.json', 'js/tsconfig.test.json'];
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
        `TypeScript ${this.typeScriptWas} was brought down to ^5.9.3: flarum-tsconfig resolves modules the way TypeScript 6 refuses without ignoreDeprecations.`,
      this.removedCompilerOptions.length > 0 &&
        `Removed from js/tsconfig.json, as TypeScript 5.9 refuses them: ${this.removedCompilerOptions.join(', ')}.`,
      this.addedTypings.length > 0 && `Added what the reusable frontend workflow runs to build and check typings: ${this.addedTypings.join(', ')}.`,
      this.movedToDev.length > 0 && `Moved to devDependencies, as the extension only builds with them: ${this.movedToDev.join(', ')}.`,
      this.keptNewer.length > 0 && `Kept, as they already ask for newer versions than Flarum 2.0 needs: ${this.keptNewer.join(', ')}.`,
    ].filter(Boolean);

    return [
      'Dependencies updated. Please review the changes and update any other dependency versions as needed.',
      ...notes,
      `It is recommended to run ${composerInstall} or ${composerUpdate} and ${yarn} or ${npm} now.`,
      'But you may also leave that until the upgrade process is over.',
    ].join('\n                     ');
  }

  /**
   * Require at least the given version, leaving a constraint that already
   * asks for a newer one as it is.
   */
  protected raise(dependencies: Record<string, string>, name: string, version: string): void {
    if (asksForNewer(String(dependencies[name]), version)) {
      this.keptNewer.push(`${name} ${dependencies[name]}`);
    } else {
      dependencies[name] = version;
    }
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
          this.raise(composer.require, key, '^2.0.0');
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
          this.raise(composer['require-dev'], key, '^2.0.0');
        } else if (key.startsWith('flarum/') && (value as string).startsWith('^1')) {
          composer['require-dev'][key] = '*';
        }
      }

      // An extension using newer PHP than Flarum 2.0 needs keeps asking for it.
      if (composer.require.php) {
        this.raise(composer.require, 'php', '^8.3');
      }

      // Flarum 2.0 is stable, so its constraints resolve without changing the
      // extension's minimum stability.

      if (composer.require['fof/extend']) {
        this.raise(composer.require, 'fof/extend', '^2.0.0');
      }

      return {
        updated: composer,
      };
    };
  }

  updatePackageJson(): Replacement {
    return (_file, _code, advanced) => {
      advanced = advanced as Record<string, any>;

      // The versions a new extension is scaffolded with. 3.1.0 is the first
      // flarum-webpack-config that supplies TypeScript 5.9 and only asks for
      // webpack as a peer, and @flarum/jest-config 2.1.1 tests with the mithril
      // Flarum ships and requires that flarum-webpack-config. Prettier 3 is what
      // the upgrade has just formatted the code with.
      const map: Record<string, string> = {
        'flarum-webpack-config': '^3.1.0',
        'flarum-tsconfig': '^2.0.0',
        '@flarum/jest-config': '^2.1.1',
        prettier: '^3.9.10',
        webpack: '^5.104.1',
        'webpack-cli': '^7.2.3',
        // What Flarum builds and checks its typings with.
        typescript: '^5.9.3',
      };

      // Extensions list the tooling under either key, often split between both.
      for (const dependencies of [advanced.dependencies, advanced.devDependencies]) {
        for (const key of Object.keys(dependencies || {})) {
          // TypeScript is the exception: it moves to what Flarum checks typings
          // with, whatever the extension asked for. flarum-tsconfig resolves
          // modules the way TypeScript 6 refuses, so a newer one comes down,
          // unless the extension's tsconfig already resolves them another way.
          if (key === 'typescript' && allowsSixOrNewer(String(dependencies[key])) && this.tsConfigReadsWithSixOrNewer()) {
            this.keptNewer.push(`${key} ${dependencies[key]}`);
          } else if (key === 'typescript') {
            if (allowsSixOrNewer(String(dependencies[key]))) {
              this.typeScriptWas = dependencies[key];
            }

            dependencies[key] = map[key];
          } else if (map[key]) {
            this.raise(dependencies, key, map[key]);
          }
        }
      }

      if (advanced.scripts?.['post-build-typings'] === GNU_POST_BUILD_TYPINGS) {
        advanced.scripts['post-build-typings'] = PORTABLE_POST_BUILD_TYPINGS;
      }

      this.addTypingsScripts(advanced);
      this.moveToolingToDevDependencies(advanced);

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
   * Add the scripts that build and check typings, which a new extension is
   * scaffolded with and the reusable frontend workflow runs, along with the
   * tooling they need. Scripts the extension already has are left alone.
   */
  protected addTypingsScripts(pkg: Record<string, any>): void {
    const missing = TYPINGS_SCRIPTS.filter((name) => !pkg.scripts?.[name]);

    if (missing.length === 0) return;

    if (!this.hasTsConfig()) {
      this.leaveTodo(
        'js/tsconfig.json',
        'Add a tsconfig.json, then the scripts that build and check typings, which the reusable frontend workflow runs: ' + missing.join(', ') + '.'
      );

      return;
    }

    const scaffolded = scaffoldedPackageJson(this.packageManager());

    pkg.scripts = { ...pkg.scripts };

    for (const name of missing) {
      pkg.scripts[name] = scaffolded.scripts[name];
    }

    const listed = { ...pkg.dependencies, ...pkg.devDependencies };
    const tooling = TYPINGS_TOOLING.filter((name) => !listed[name]);

    if (tooling.length > 0) {
      pkg.devDependencies = sortedByName({
        ...pkg.devDependencies,
        ...Object.fromEntries(tooling.map((name) => [name, scaffolded.devDependencies[name]])),
      });
    }

    this.addedTypings.push(...missing, ...tooling);
  }

  protected hasTsConfig(): boolean {
    return fs.existsSync(path.join(this.root, 'js/tsconfig.json'));
  }

  /** The package manager the extension's frontend uses, by its lockfile. */
  protected packageManager(): 'yarn' | 'npm' {
    return fs.existsSync(path.join(this.root, 'js/yarn.lock')) ? 'yarn' : 'npm';
  }

  /**
   * Flarum 2.0 extensions only build with their tooling: none of it ends up
   * in the bundle, so it belongs in devDependencies. Where the extension lists
   * a tool under both keys, the newer constraint is kept. Other dependencies
   * may be libraries the bundle includes, so they stay where they are.
   */
  protected moveToolingToDevDependencies(pkg: Record<string, any>): void {
    const moving = Object.keys(pkg.dependencies || {}).filter((name) => BUILD_TOOLING.has(name) || name.startsWith('@types/'));

    if (moving.length === 0) return;

    const devDependencies: Record<string, string> = { ...pkg.devDependencies };

    for (const name of moving) {
      if (!devDependencies[name] || asksForNewer(String(pkg.dependencies[name]), String(devDependencies[name]))) {
        devDependencies[name] = pkg.dependencies[name];
      }

      delete pkg.dependencies[name];
    }

    pkg.devDependencies = sortedByName(devDependencies);
    this.movedToDev.push(...moving);
  }

  /**
   * Drop the compiler options, and option values, TypeScript 5.9 refuses: it
   * won't read a tsconfig.json with any. A tsconfig.json it can read is left
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

      this.removedCompilerOptions.push(...removed);

      return removed.length > 0 ? { updated: tsconfig } : null;
    };
  }

  /**
   * TypeScript loads every type package in node_modules unless told which,
   * including the @types/node that webpack's minimizer brings along. Load only
   * the ones the code imports. The file is edited as text so its comments stay.
   */
  limitTypes(): Replacement {
    return (_file, code, advanced) => {
      if ((advanced as Record<string, any>)?.compilerOptions?.types !== undefined) return null;

      const updated = insertCompilerOption(code, TYPES_COMMENT, '"types": []');

      if (!updated) return null;

      const globals = Object.keys({ ...this.packageJson().dependencies, ...this.packageJson().devDependencies }).filter(
        (name) => name.startsWith('@types/') && name !== '@types/jest'
      );

      if (globals.length > 0) {
        this.leaveTodo(
          'js/tsconfig.json',
          `It only loads the type packages the code imports now. If the code uses the globals of ${globals.join(', ')}, list them in compilerOptions.types.`
        );
      }

      return { updated };
    };
  }

  /**
   * A test config extending tsconfig.json would no longer load Jest's globals.
   */
  testTypes(): Replacement {
    return (_file, code, advanced) => {
      if ((advanced as Record<string, any>)?.compilerOptions?.types !== undefined) return null;

      const pkg = this.packageJson();
      const listed = { ...pkg.dependencies, ...pkg.devDependencies };

      if (!['@flarum/jest-config', 'jest', '@types/jest'].some((name) => listed[name])) return null;

      const updated = insertCompilerOption(code, null, '"types": ["jest"]');

      return updated ? { updated } : null;
    };
  }

  /**
   * Whether TypeScript 6 and newer accept the extension's tsconfig.json: it
   * replaces the moduleResolution flarum-tsconfig sets, which they refuse, and
   * sets no baseUrl, which they refuse too.
   */
  protected tsConfigReadsWithSixOrNewer(): boolean {
    try {
      const code = fs.readFileSync(path.join(this.root, 'js/tsconfig.json'), 'utf8');
      const options = (this.advancedContent('js/tsconfig.json', code) as Record<string, any>)?.compilerOptions ?? {};

      return ['bundler', 'node16', 'nodenext'].includes(String(options.moduleResolution).toLowerCase()) && options.baseUrl === undefined;
    } catch {
      return false;
    }
  }

  /** The extension's js/package.json, or nothing when it has none. */
  protected packageJson(): Record<string, any> {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.root, 'js/package.json'), 'utf8'));
    } catch {
      return {};
    }
  }
}
