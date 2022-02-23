import { Command, Flags, Interfaces } from '@oclif/core';
import cli from 'cli-ux';
import { resolve } from 'node:path';
import globby from 'globby';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { IO, PromptsIO } from 'boilersmith/io';
import { StepManager } from 'boilersmith/step-manager';
import { NodePaths } from 'boilersmith/paths';
import { PhpSubsystemProvider } from './providers/php-provider';
import chalk from 'chalk';
import { FlarumProviders } from './providers';
import { exit } from '@oclif/errors';
import { composerPath, corePath, extensionPath, getMonorepoConf, npmPath } from './utils/monorepo';
import { create } from 'mem-fs';

export enum LocationType {
  FLARUM_EXTENSION,
  FLARUM_CORE,
  FLARUM_MONOREPO,
}

export default abstract class BaseCommand extends Command {
  protected STUB_PATH = resolve(__dirname, '../boilerplate/stubs/');

  protected dry = false;
  protected locationType?: LocationType;

  protected args!: Record<string, any>;
  protected flags: any;

  static flags: Interfaces.FlagInput<any> = {
    'no-interaction': Flags.boolean({
      char: 'n',
      description: 'Do not ask any interactive questions, assume defaults. When impossible, error.',
      default: false,
    }),
    help: Flags.help({ char: 'h' }),
  };

  static args = [
    {
      name: 'path',
      description: 'Where should this command be executed?',
    },
  ];

  protected requireExistingExtension = true;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(this.constructor as any);

    this.args = args;
    this.flags = flags;

    const path: string | undefined = args.path;

    const welcomeMessage = this.welcomeMessage();
    if (welcomeMessage) {
      this.log(welcomeMessage);
    }

    let extRoot: string;

    if (this.requireExistingExtension) {
      const rootData = await this.getFlarumExtensionRoot(path || process.cwd());
      extRoot = rootData.path;
      this.locationType = rootData.type;

      await this.confirmExtDir(extRoot);
    } else {
      extRoot = path || process.cwd();
    }

    await this.additionalPreRunChecks(extRoot);

    const paths = new NodePaths({
      requestedDir: path,
      package: extRoot,
    });

    const phpProvider = new PhpSubsystemProvider(resolve(__dirname, '../php-subsystem/index.php'));

    const out = await this.steps(new StepManager<FlarumProviders>(), extRoot).run(paths, this.genIO(), { php: phpProvider }, this.dry);

    const errorMessages = out.messages.filter((m) => m.type === 'error');

    this.log('\n\n');
    if (out.succeeded && errorMessages.length === 0) {
      this.log(chalk.bold(chalk.underline(chalk.green('Success! The following steps were completed:'))));
    } else if (out.succeeded) {
      this.log(chalk.bold(chalk.underline(chalk.yellow('All steps completed, but with some errors:'))));

      for (const message of errorMessages) {
        this.log(chalk.dim(chalk.red(message.message)));
      }

      this.log(chalk.bold(chalk.yellow('The steps that completed were:')));
    } else if (out.error.startsWith('EEXIT:')) {
      this.log(chalk.bold(chalk.underline(chalk.red('Exiting.'))));
      if (out.stepsRan.length > 0) {
        this.log(chalk.bold(chalk.yellow('Before the exit, the following steps were completed:')));
      }
    } else {
      this.log(chalk.bold(chalk.underline(chalk.red('Error occurred, and could not complete:'))));
      this.log(chalk.red(out.error));
      if (out.errorTrace) {
        this.log(chalk.dim(chalk.red(out.errorTrace)));
      }

      if (out.stepsRan.length > 0) {
        this.log('');
        this.log(chalk.bold(chalk.yellow('Before the error, the following steps were completed:')));
      }
    }

    for (const stepName of out.stepsRan) this.log(`- ${chalk.dim(stepName)}`);

    this.log('');
    const nonErrorMessages = out.messages.filter((m) => m.type !== 'error');
    if (nonErrorMessages.length > 0) {
      this.log('');
      this.log('The following messages were generated during execution:');
      for (const message of nonErrorMessages) {
        this.log(message.message);
      }
    }

    if (!out.succeeded || errorMessages.length > 0) {
      this.exit(1);
    }

    const goodbyeMessage = this.goodbyeMessage();
    if (goodbyeMessage) {
      this.log(goodbyeMessage);
    }
  }

  protected welcomeMessage(): string {
    return '';
  }

  protected goodbyeMessage(): string {
    return 'Please make sure to check my work, adjust formatting, and test before committing!!!';
  }

  protected async additionalPreRunChecks(_extRoot: string): Promise<void> {
    // Can be implemented if needed.
  }

  protected abstract steps(stepManager: StepManager<FlarumProviders>, extRoot: string): StepManager<FlarumProviders>;

  // ----------------------------------------------------------------
  // Confirmation
  // ----------------------------------------------------------------

  protected genIO(): IO {
    return new PromptsIO({}, [], this.flags['no-interaction'], exit);
  }

  protected monorepoPaths(options: {
    includeCore: boolean;
    includeExtensions: boolean;
    includePhpPackages: boolean;
    includeJSPackages: boolean;
  }): string[] {
    try {
      const monorepoConfig = getMonorepoConf(create(), new NodePaths({ package: process.cwd() }));

      return [
        ...(options.includeCore && monorepoConfig.packages.core ? [corePath(monorepoConfig.packages.core.name)] : []),
        ...(options.includeExtensions ? monorepoConfig.packages.extensions : []).map((ext) => extensionPath(ext.name)),
        ...(options.includePhpPackages ? monorepoConfig.packages.composer ?? [] : []).map((lib) => composerPath(lib.name)),
        ...(options.includeJSPackages ? monorepoConfig.packages.npm ?? [] : []).map((lib) => npmPath(lib.name)),
      ];
    } catch {
      this.error('Could not run monorepo command: `flarum-monorepo.json` file is missing or invalid.');
    }
  }

  protected isFlarumMonorepo(path: string): boolean {
    return existsSync(resolve(path, 'flarum-monorepo.json'));
  }

  protected isFlarumCore(path: string): boolean {
    try {
      const composerJsonPath = resolve(path, 'composer.json');
      const val = JSON.parse(readFileSync(composerJsonPath, 'utf8'));
      return val.name === 'flarum/core';
    } catch {
      return false;
    }
  }

  protected jsPackageManager(currDir: string): 'yarn' | 'npm' | null {
    if (!existsSync(resolve(currDir, 'js'))) return null;

    return existsSync(resolve(currDir, 'js/yarn.lock')) ? 'yarn' : 'npm';
  }

  protected async getFlarumExtensionRoot(currDir: string): Promise<{ path: string; type: LocationType }> {
    let currPath = resolve(currDir);

    while (currPath !== '/') {
      if (existsSync(resolve(currPath, 'flarum-monorepo.json'))) {
        return { path: currPath, type: LocationType.FLARUM_MONOREPO };
      }

      if (existsSync(resolve(currPath, 'composer.json')) && existsSync(resolve(currPath, 'extend.php'))) {
        return { path: currPath, type: LocationType.FLARUM_EXTENSION };
      }

      if (this.isFlarumCore(currPath)) {
        return { path: currPath, type: LocationType.FLARUM_CORE };
      }

      currPath = resolve(currPath, '..');
    }

    this.error(
      `${resolve(currDir)} is not located in a valid Flarum package!
- Flarum extensions must contain (at a minimum) 'extend.php' and 'composer.json' files.
- Flarum core must contain a 'composer.json' file with the name 'flarum/core'.
- Flarum monorepos must have a valid 'flarum-monorepo.json' file`
    );
  }

  protected async confirmExtDir(extRoot: string): Promise<void> {
    const verify = await this.genIO().getParam({
      name: 'verify',
      type: 'confirm',
      message: `Work in Flarum package located at ${resolve(extRoot)}?`,
      initial: true,
    });

    if (!verify) this.exit();
  }

  protected async ensureComposerInstallRan(extRoot: string): Promise<void> {
    if (existsSync(resolve(extRoot, 'vendor/flarum/core/composer.json'))) return;

    this.log("This command requires `composer install` to have been ran in your extension's root directory.");

    const composer = await this.genIO().getParam({
      name: 'composer',
      type: 'confirm',
      message: 'Would you like me to take care of that for you?',
      initial: true,
    });

    if (composer) {
      cli.action.start('Installing composer packages');
      execSync('composer install', { cwd: extRoot });
      cli.action.stop();
    } else {
      this.error("Run `composer install` in your extension's root directory, then try again.");
    }
  }

  /**
   * If false, files do not exist so no need to override.
   * If true, files should be overriden.
   * If user says no, will exit and not return anything.
   */
  protected async confirmOverrideFiles(dir: string, pattern: string | string[], confirmationMessage: string): Promise<boolean> {
    const paths = Array.isArray(pattern) ? pattern : [pattern];
    const files = await globby(paths.map((p) => resolve(dir, p)));

    const empty = files.length === 0 || (files.length === 1 && files[0] === '.git');

    if (empty) return false;

    const overwrite = await this.genIO().getParam({
      name: 'overwrite',
      type: 'confirm',
      message: confirmationMessage,
      initial: true,
    });

    if (overwrite === false) this.exit();

    return true;
  }

  protected async deleteFiles(dir: string, pattern: string): Promise<void> {
    const pathsToDelete = await globby(resolve(dir, pattern));

    pathsToDelete.forEach(unlinkSync);
  }
}
