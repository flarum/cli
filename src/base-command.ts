import { Command, Flags, Interfaces } from '@oclif/core';
import cli from 'cli-ux';
import { resolve } from 'node:path';
import prompts from 'prompts';
import globby from 'globby';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { PromptsIO, PROMPTS_OPTIONS } from 'boilersmith/io';
import { StepManager } from 'boilersmith/step-manager';
import { NodePaths } from 'boilersmith/paths';
import { PhpSubsystemProvider } from './providers/php-provider';
import chalk from 'chalk';
import { FlarumProviders } from './providers';

export default abstract class BaseCommand extends Command {
  protected STUB_PATH = resolve(__dirname, '../boilerplate/stubs/');

  protected dry = false;

  protected args!: Record<string, any>;
  protected flags: any;

  static flags: Interfaces.FlagInput<any> = {
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
      extRoot = await this.getFlarumExtensionRoot(path || process.cwd());

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

    const out = await this.steps(new StepManager<FlarumProviders>())
      .run(paths, new PromptsIO(), { php: phpProvider }, this.dry);

    const errorMessages = out.messages.filter(m => m.type === 'error');

    this.log('\n\n');
    if (out.succeeded && errorMessages.length === 0) {
      this.log(chalk.bold(chalk.underline(chalk.green('Success! The following steps were completed:'))));
    } else if (out.succeeded) {
      this.log(chalk.bold(chalk.underline(chalk.yellow('All steps completed, but with some errors:'))));

      for (const message of errorMessages) {
        this.log(chalk.dim(chalk.red(message.message)));
      }

      this.log(chalk.bold(chalk.yellow('The steps that completed were:')));
    } else {
      this.log(chalk.bold(chalk.underline(chalk.red('Error occurred, and could not complete:'))));
      this.log(chalk.red(out.error));
      if (out.errorTrace) {
        this.log(chalk.dim(chalk.red(out.errorTrace)));
      }

      if (out.stepsRan.length > 0) {
        this.log(chalk.bold(chalk.yellow('Before the error, the following steps were completed:')));
      }
    }

    for (const stepName of out.stepsRan) this.log(`- ${chalk.dim(stepName)}`);

    this.log('');
    const nonErrorMessages = out.messages.filter(m => m.type !== 'error');
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

  protected abstract steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders>;

  // ----------------------------------------------------------------
  // Confirmation
  // ----------------------------------------------------------------

  protected monorepoPaths(options: {includeCore: boolean; includeExtensions: boolean; includePhpPackages: boolean; includeJSPackages: boolean}): string[] {
    try {
      const monorepoConfig = readFileSync(resolve(process.cwd(), 'flarum-monorepo.json'));
      const contents = JSON.parse(monorepoConfig.toString());

      return [
        ...(options.includeCore ? [contents.core] : []),
        ...(options.includeExtensions ? contents.extensions : []),
        ...(options.includePhpPackages ? contents.composerPackages : []),
        ...(options.includeJSPackages ? contents.npmPackages : []),
      ];
    } catch {
      this.error('Could not run monorepo command: `flarum-monorepo.json` file is missing or invalid.');
    }
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

  protected async getFlarumExtensionRoot(currDir: string): Promise<string> {
    let currPath = resolve(currDir);

    while (currPath !== '/') {
      if (existsSync(resolve(currPath, 'composer.json')) && (existsSync(resolve(currPath, 'extend.php')) || this.isFlarumCore(currPath))) {
        return currPath;
      }

      currPath = resolve(currPath, '..');
    }

    this.error(
      `${resolve(
        currDir,
      )} is not located in a valid Flarum package! Flarum extensions must contain (at a minimum) 'extend.php' and 'composer.json' files.`,
    );
  }

  protected async confirmExtDir(extRoot: string): Promise<void> {
    const response = await prompts([
      {
        name: 'verify',
        type: 'confirm',
        message: `Work in Flarum package located at ${resolve(extRoot)}?`,
        initial: true,
      },
    ], PROMPTS_OPTIONS);

    if (!response.verify) this.exit();
  }

  protected async ensureComposerInstallRan(extRoot: string): Promise<void> {
    if (existsSync(resolve(extRoot, 'vendor/flarum/core/composer.json'))) return;

    this.log("This command requires `composer install` to have been ran in your extension's root directory.");

    const response = await prompts([
      {
        name: 'composer',
        type: 'confirm',
        message: 'Would you like me to take care of that for you?',
        initial: true,
      },
    ], PROMPTS_OPTIONS);

    if (response.composer) {
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
    const files = await globby(paths.map(p => resolve(dir, p)));

    const empty = files.length === 0 || (files.length === 1 && files[0] === '.git');

    if (empty) return false;

    const response = await prompts([
      {
        name: 'overwrite',
        type: 'confirm',
        message: confirmationMessage,
      },
    ], PROMPTS_OPTIONS);

    if (response.overwrite === false) this.exit();

    return true;
  }

  protected async deleteFiles(dir: string, pattern: string): Promise<void> {
    const pathsToDelete = await globby(resolve(dir, pattern));

    pathsToDelete.forEach(unlinkSync);
  }
}
