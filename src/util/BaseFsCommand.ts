import { Command, flags } from '@oclif/command';
import { IConfig } from '@oclif/config';
import cli from 'cli-ux';
import path from 'path';
import { create as createMemFs, Store } from 'mem-fs';
import { create as createMemFsEditor, Editor } from 'mem-fs-editor';
import prompts, { Options } from 'prompts';
import { MemFsUtil } from './MemfsUtil';

export default abstract class BaseFsCommand extends Command {
  static flags: flags.Input<any> = {
    help: flags.help({ char: 'h' })
  }

  static args = [{
    name: 'path',
    description: "The Flarum extension's directory",
    default: process.cwd(),
    parse: path.resolve
  }];

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

  protected async assertInFlarumInstallation(dir: string) {
    const memFsUtil = new MemFsUtil(this.fs, dir);

    if (!memFsUtil.exists('composer.json') || !memFsUtil.exists('extend.php')) {
      this.error(`${path.resolve(dir)} is not a valid Flarum extension! Flarum extensions must contain (at a minimum) 'extend.php' and 'composer.json' files.`);
    }
  }

  protected async confirmDir(dir: string) {
    const response = await prompts(
      [
        {
          name: 'verify',
          type: 'confirm',
          message: `Work in ${path.resolve(dir)}?`,
          initial: true,
        }
      ],
    )

    if (!response.verify) this.exit();
  }

  protected async fsCommit(dir: string) {
    cli.action.start("Finalizing...");

    this.fs.commit(err => {
      if (err) {
        cli.action.stop("Failed");
        this.error(err);
      }

      cli.action.stop();
    });
  }

  // ----------------------------------------------------------------
  // Utils
  // ----------------------------------------------------------------

  protected getBoilerplateDir(subdir?: string) {
    return path.resolve(__dirname, '../../boilerplate', subdir as string);
  }

  /**
   * Some infra steps will copy over portions of the boilerplate.
   * To do this, we need to fill in the templated fields in our boilerplate files
   * so they have valid syntax, so we simulate those fields here.
   * TODO: Figure out how to generate this from the init prompts so we don't need to have these keys twice.
   */
  protected simulateInitPromptData(dir: string) {
    const data: any = {}
    const extensionComposerJson: any = this.fs.readJSON(path.resolve(dir, 'composer.json'));
    data.packageName = extensionComposerJson.name || '';
    data.packageDescription = extensionComposerJson.description || '';
    data.license = extensionComposerJson.license || '';
    data.authorName = '';
    data.authorEmail = '';
    data.packageNamespace = (Object.keys(extensionComposerJson?.autoload["psr-4"] ?? {})[0] || '').slice(0, -1).replace("\\", "\\\\");
    data.extensionName = extensionComposerJson?.extra["flarum-extension"].title || '';

    return data;
  }
}
