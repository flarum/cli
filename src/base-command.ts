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

    const completed = await this.steps(new StepManager<FlarumProviders>())
      .run(paths, new PromptsIO(), { php: phpProvider });

    this.log('\n\n');
    this.log(chalk.bold(chalk.underline(chalk.green('Success! The following steps were completed:'))));

    for (const stepName of completed) this.log(`- ${chalk.dim(stepName)}`);

    this.log('');

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
