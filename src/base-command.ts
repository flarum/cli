import { Command, Flags, Interfaces } from '@oclif/core';
import cli from 'cli-ux';
import { resolve } from 'path';
import globby from 'globby';
import { execSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { IO, Message, PromptsIO } from 'boilersmith/io';
import { StepManager } from 'boilersmith/step-manager';
import { NodePaths } from 'boilersmith/paths';
import { PhpSubsystemProvider } from './providers/php-provider';
import chalk from 'chalk';
import { FlarumProviders } from './providers';
import { exit } from '@oclif/errors';
import { composerPath, corePath, extensionPath, getMonorepoConf, npmPath } from './utils/monorepo';
import { create } from 'mem-fs';
import { overwrite, stripAnsi } from './utils/terminal';

export enum LocationType {
  FLARUM_EXTENSION,
  FLARUM_CORE,
  FLARUM_MONOREPO,
}

export default abstract class BaseCommand extends Command {
  public STUB_PATH = resolve(__dirname, '../boilerplate/stubs/');

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

  static args: Interfaces.ArgInput = [
    {
      name: 'path',
      description: 'Where should this command be executed?',
    },
  ];

  static classNameArg: Interfaces.Arg = {
    name: 'className',
    description: 'The name of the class to generate',
    required: false,
  };

  protected requireExistingExtension = true;

  protected skipFinalMessage = false;

  async runSteps(steps: StepManager<FlarumProviders>) {
    const { args } = await this.parse(this.constructor as any);

    this.args = args;
    const path: string | undefined = args.path;

    const paths = new NodePaths({
      requestedDir: path,
      package: await this.extRoot(path),
    });

    const phpProvider = new PhpSubsystemProvider(resolve(__dirname, '../php-subsystem/index.php'));

    return steps.run(paths, this.genIO(), { php: phpProvider }, this.dry, args);
  }

  async extRoot(path: string | undefined): Promise<string> {
    let extRoot: string;

    if (this.requireExistingExtension) {
      const rootData = await this.getFlarumExtensionRoot(path || process.cwd());
      extRoot = rootData.path;
      this.locationType = rootData.type;

      await this.confirmExtDir(extRoot);
    } else {
      extRoot = path || process.cwd();
    }

    return extRoot;
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(this.constructor as any);

    this.args = args;
    this.flags = flags;

    const path: string | undefined = args.path;

    const welcomeMessage = this.welcomeMessage();

    if (welcomeMessage) {
      this.log(welcomeMessage);
      await this.continueWhenReady(this.genIO());
    }

    const extRoot = await this.extRoot(path);

    await this.additionalPreRunChecks(extRoot);

    const out = await this.runSteps(this.steps(new StepManager<FlarumProviders>(), extRoot));

    const errorMessages = out.messages.filter((m) => m.type === 'error');

    if (this.jsonEnabled()) {
      const succeeded = out.succeeded && errorMessages.length === 0;
      const error = out.succeeded ? errorMessages[0]?.message ?? null : out.error;

      this.writeJson(this.jsonReport(succeeded, error, out.messages));

      if (!succeeded) process.exitCode = 1;

      return;
    }

    // this.log('\n\n');

    if (!this.skipFinalMessage && out.succeeded && errorMessages.length === 0) {
      this.log(chalk.bold(chalk.underline(chalk.green('Success! The following steps were completed:'))));
    } else if (!this.skipFinalMessage && out.succeeded) {
      this.log(chalk.bold(chalk.underline(chalk.yellow('All steps completed, but with some errors:'))));

      for (const message of errorMessages) {
        this.log(chalk.dim(chalk.red(message.message)));
      }

      this.log(chalk.bold(chalk.yellow('The steps that completed were:')));
    } else if (!out.succeeded && out.error.startsWith('EEXIT:')) {
      this.log(chalk.bold(chalk.underline(chalk.red('Exiting.'))));

      if (!this.skipFinalMessage && out.stepsRan.length > 0) {
        this.log(chalk.bold(chalk.yellow('Before the exit, the following steps were completed:')));
      }
    } else if (!out.succeeded) {
      const prettyPrint = out.e?.code === 'FL_ERR';

      if (!prettyPrint) this.log(chalk.bold(chalk.underline(chalk.red('Error occurred, and could not complete:'))));

      if (prettyPrint) {
        this.log('\n');
        this.log(overwrite() + '     => ' + chalk.bgRed.bold('   ERROR   ') + ' ' + chalk.red(out.error));
      } else {
        this.log(chalk.red(out.error));
      }

      if (out.errorTrace && !prettyPrint) {
        this.log(chalk.dim(chalk.red(out.errorTrace)));
      }

      if (out.stepsRan.length > 0) {
        this.log('');
        this.log(chalk.bold(chalk.yellow('Before the error, the following steps were completed:')));
      }
    }

    if (!this.skipFinalMessage) {
      for (const stepName of out.stepsRan) this.log(`- ${chalk.dim(stepName)}`);
    }

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

  /**
   * The result of a run with `--json`, for the program that started it.
   */
  protected jsonReport(succeeded: boolean, error: string | null, messages: Message[]): Record<string, unknown> {
    return {
      status: succeeded ? 'succeeded' : 'failed',
      error: error === null ? null : stripAnsi(error),
      messages: messages.map((m) => ({ ...m, message: stripAnsi(m.message) })),
    };
  }

  /**
   * Written by hand rather than returned from `run()`: oclif colours JSON it
   * prints itself whenever the output is a terminal.
   */
  protected writeJson(report: Record<string, unknown>): void {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  }

  /**
   * With `--json`, an error before or between steps is still reported as JSON.
   */
  async catch(err: any): Promise<any> {
    if (!this.jsonEnabled()) return super.catch(err);

    const code = err?.oclif?.exit ?? 1;

    if (code === 0) return;

    process.exitCode = code;

    this.writeJson(this.jsonReport(false, err?.message ?? String(err), []));
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
    // Nobody can answer a prompt when a program is reading the output.
    return new PromptsIO(this.args, [], this.flags['no-interaction'] || this.jsonEnabled(), exit);
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

  protected confirmed = false;

  protected async confirmExtDir(extRoot: string): Promise<void> {
    if (this.confirmed) return;

    const verify = await this.genIO().getParam({
      name: 'verify',
      type: 'confirm',
      message: `Work in Flarum package located at ${resolve(extRoot)}?`,
      initial: true,
    });

    if (!verify) this.exit();

    this.confirmed = true;
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

  public async continueWhenReady(io: IO): Promise<void> {
    const continueUpgrade = await io.getParam({
      name: 'continue',
      type: 'confirm',
      message: 'Ready to continue?',
      initial: true,
    });

    if (!continueUpgrade) {
      this.log('');
      this.log('Aborted.');
      this.exit();
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
