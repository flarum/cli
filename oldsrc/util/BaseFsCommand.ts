import {Command, flags} from '@oclif/command'
import {IConfig} from '@oclif/config'
import cli from 'cli-ux'
import path from 'path'
import {create as createMemFs, Store} from 'mem-fs'
import {create as createMemFsEditor, Editor} from 'mem-fs-editor'
import prompts, {Options} from 'prompts'
import {MemFsUtil} from './MemfsUtil'
import {execSync} from 'child_process'

export default abstract class BaseFsCommand extends Command {
  static flags: flags.Input<any> = {
    help: flags.help({char: 'h'}),
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
    super(argv, config)

    this.store = createMemFs()
    this.fs = createMemFsEditor(this.store)
    this.promptsOptions = {onCancel: () => this.exit()}
  }

  // ----------------------------------------------------------------
  // Reusable Steps
  // ----------------------------------------------------------------

  protected async getFlarumExtensionRoot(currDir: string) {
    let currPath = path.resolve(currDir)

    while (currPath !== '/') {
      if (this.fs.exists(path.resolve(currPath, 'composer.json')) && this.fs.exists(path.resolve(currPath, 'extend.php'))) {
        return currPath
      }

      currPath = path.resolve(currPath, '..')
    }

    this.error(
      `${path.resolve(
        currDir
      )} is not located in a valid Flarum extension! Flarum extensions must contain (at a minimum) 'extend.php' and 'composer.json' files.`
    )
  }

  protected async confirmDir(dir: string) {
    const response = await prompts([
      {
        name: 'verify',
        type: 'confirm',
        message: `Work in ${path.resolve(dir)}?`,
        initial: true,
      },
    ], this.promptsOptions)

    if (!response.verify) this.exit()
  }

  protected async ensureComposerInstallRan(dir: string) {
    const needed = false
    if (new MemFsUtil(this.fs, dir).exists('vendor/flarum/core/composer.json')) return

    this.log("This command requires `composer install` to have been ran in your extension's root directory.")

    const response = await prompts([
      {
        name: 'composer',
        type: 'confirm',
        message: 'Would you like me to take care of that for you?',
        initial: true,
      },
    ], this.promptsOptions)

    if (response.composer) {
      cli.action.start('Installing composer packages')
      execSync('composer install', {cwd: dir})
      cli.action.stop()
    } else {
      this.error("Run `composer install` in your extension's root directory, then try again.")
    }
  }

  // ----------------------------------------------------------------
  // Utils
  // ----------------------------------------------------------------

  protected getCliDir() {
    return path.resolve(__dirname, '../..')
  }
}
