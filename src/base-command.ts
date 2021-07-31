import { Command, flags } from '@oclif/command';
import cli from 'cli-ux';
import { resolve } from 'path';
import prompts from 'prompts';
import globby from 'globby';
import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { paramProviderFactory, PROMPTS_OPTIONS } from './provider/param-provider';
import { StepManager } from './steps/step-manager';
import { PathFsProvider } from './provider/path-provider';
import { PhpSubsystemProvider } from './provider/php-provider';
import chalk from 'chalk';

export default abstract class BaseCommand extends Command {
  static flags: flags.Input<any> = {
    help: flags.help({ char: 'h' }),
  };

  static args = [
    {
      name: 'path',
      description: 'Where should this command be executed?',
    },
  ];

  protected requireExistingExtension = true;

  async run() {
    const { args } = this.parse(this.constructor as any);

    const path: string|undefined = args.path;

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

    const pathProvider = new PathFsProvider({
      requestedDir: path,
      ext: extRoot,
    });

    const phpProvider = new PhpSubsystemProvider(resolve(__dirname, '../php-subsystem/index.php'));

    const completed = await this.steps(new StepManager())
      .run(pathProvider, paramProviderFactory, phpProvider);

    this.log('\n\n');
    this.log(chalk.bold(chalk.underline(chalk.green('Success! The following steps were completed:'))));

    completed.forEach(stepName => this.log(`- ${chalk.dim(stepName)}`));

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

  protected async additionalPreRunChecks(_extRoot: string) {
    // Can be implemented if needed.
  }

  protected abstract steps(stepManager: StepManager): StepManager;

  // ----------------------------------------------------------------
  // Confirmation
  // ----------------------------------------------------------------

  protected async getFlarumExtensionRoot(currDir: string) {
    let currPath = resolve(currDir);

    while (currPath !== '/') {
      if (existsSync(resolve(currPath, 'composer.json')) && existsSync(resolve(currPath, 'extend.php'))) {
        return currPath;
      }

      currPath = resolve(currPath, '..');
    }

    this.error(
      `${resolve(
        currDir
      )} is not located in a valid Flarum extension! Flarum extensions must contain (at a minimum) 'extend.php' and 'composer.json' files.`
    );
  }

  protected async confirmExtDir(extRoot: string) {
    const response = await prompts([
      {
        name: 'verify',
        type: 'confirm',
        message: `Work in Flarum extension located at ${resolve(extRoot)}?`,
        initial: true,
      },
    ], PROMPTS_OPTIONS);

    if (!response.verify) this.exit();
  }

  protected async ensureComposerInstallRan(extRoot: string) {
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
  protected async confirmOverrideFiles(dir: string, pattern: string, confirmationMessage: string): Promise<boolean> {
    const files = await globby(resolve(dir, pattern));

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

  protected async  deleteFiles(dir: string, pattern: string) {
    const pathsToDelete = await globby(resolve(dir, pattern));

    pathsToDelete.forEach(unlinkSync);
  }
}
