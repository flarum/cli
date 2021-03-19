import { Command, flags } from '@oclif/command';
import { IConfig } from '@oclif/config';
import cli from 'cli-ux';
import path from 'path';
import { create as createMemFs, Store } from 'mem-fs';
import { create as createMemFsEditor, Editor } from 'mem-fs-editor';
import prompts, { Options } from 'prompts';
import { MemFsUtil } from './MemfsUtil';
import { execFileSync, execSync } from 'child_process';
import ExtenderParams from '../contracts/ExtenderParamsInterface';

export default abstract class BaseFsCommand extends Command {
  static flags: flags.Input<any> = {
    help: flags.help({ char: 'h' }),
  };

  static args = [
    {
      name: 'path',
      description: "The Flarum extension's directory",
      default: process.cwd(),
      parse: path.resolve,
    },
  ];

  protected fs: Editor;
  protected store: Store;
  protected promptsOptions: Options;

  constructor(argv: string[], config: IConfig) {
    super(argv, config);

    this.store = createMemFs();
    this.fs = createMemFsEditor(this.store);
    this.promptsOptions = { onCancel: () => this.exit() };
  }

  // ----------------------------------------------------------------
  // Reusable Steps
  // ----------------------------------------------------------------

  protected async getFlarumExtensionRoot(currDir: string) {
    let currPath = path.resolve(currDir);

    while (currPath !== '/') {
      if (this.fs.exists(path.resolve(currPath, 'composer.json')) && this.fs.exists(path.resolve(currPath, 'extend.php'))) {
        return currPath;
      }

      currPath = path.resolve(currPath, '..');
    }

    this.error(
      `${path.resolve(
        currDir
      )} is not located in a valid Flarum extension! Flarum extensions must contain (at a minimum) 'extend.php' and 'composer.json' files.`
    );
  }

  protected async confirmDir(dir: string) {
    const response = await prompts([
      {
        name: 'verify',
        type: 'confirm',
        message: `Work in ${path.resolve(dir)}?`,
        initial: true,
      },
    ]);

    if (!response.verify) this.exit();
  }

  protected async ensureComposerInstallRan(dir: string) {
    let needed = false;
    if (new MemFsUtil(this.fs, dir).exists('vendor/flarum/core/composer.json')) return;

    this.log("This command requires `composer install` to have been ran in your extension's root directory.");

    const response = await prompts([
      {
        name: 'composer',
        type: 'confirm',
        message: 'Would you like me to take care of that for you?',
        initial: true,
      },
    ]);

    if (response.composer) {
      cli.action.start('Installing composer packages');
      execSync('composer install', { cwd: dir });
      cli.action.stop();
    } else {
      this.error("Run `composer install` in your extension's root directory, then try again.");
    }
  }

  protected async fsCommit(dir: string) {
    cli.action.start('Finalizing files');

    return new Promise((resolve, reject) => {
      this.fs.commit((err) => {
        if (err) {
          cli.action.stop('Failed');
          this.error(err);
        }

        cli.action.stop();
        resolve(0);
      });
    });
  }

  // ----------------------------------------------------------------
  // Utils
  // ----------------------------------------------------------------

  protected getCliDir(subdir?: string) {
    return path.resolve(__dirname, '../..', subdir as string);
  }

  /**
   * Some infra steps will copy over portions of the boilerplate.
   * To do this, we need to fill in the templated fields in our boilerplate files
   * so they have valid syntax, so we simulate those fields here.
   * TODO: Figure out how to generate this from the init prompts so we don't need to have these keys twice.
   */
  protected simulateInitPromptData(dir: string) {
    const data: any = {};
    const extensionComposerJson: any = this.fs.readJSON(path.resolve(dir, 'composer.json'));
    data.packageName = extensionComposerJson.name || '';
    data.packageDescription = extensionComposerJson.description || '';
    data.license = extensionComposerJson.license || '';
    data.authorName = '';
    data.authorEmail = '';
    data.packageNamespace = (Object.keys(extensionComposerJson?.autoload['psr-4'] ?? {})[0] || '').slice(0, -1).replace('\\', '\\\\');
    data.extensionName = extensionComposerJson?.extra['flarum-extension'].title || '';

    return data;
  }

  protected async addExtender(extDir: string, params: ExtenderParams): Promise<string> {
    const currExtendContents = this.fs.read(path.resolve(extDir, 'extend.php'));
    const input = JSON.stringify({
      'extend.php': currExtendContents,
      op: 'extender.add',
      params
    });

    const res = execSync(`php ${this.getCliDir('php-subsystem/index.php')}`, { input });

    return res.toString();
  }
}
