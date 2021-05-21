import chalk from 'chalk'
import {exec, execSync} from 'child_process'
import cli from 'cli-ux'
import filesystem from 'fs'
import {Editor} from 'mem-fs-editor'
import path from 'path'
import prompts from 'prompts'
import licenseList from 'spdx-license-list/simple'
import yosay from 'yosay'
import {Filesystems} from '../schemas/filesystem'
import BaseFsCommand from '../util/BaseFsCommand'
import BoilerplateBuilder from '../util/BoilerplateBuilder'

import {MemFsUtil} from '../util/MemfsUtil'

export default class Init extends BaseFsCommand {
  static description = 'create a new Flarum extension';

  static flags = {...BaseFsCommand.flags};

  static args = [...BaseFsCommand.args];

  async run() {
    const {args, flags} = this.parse(Init)

    const dir = args.path

    this.log(yosay('Welcome to a Flarum extension generator\n\n- Flarum Team'))

    await this.confirmDir(dir)

    await this.emptyDirCheck(dir)

    await this.setup(dir)

    await this.installPackages(dir)

    this.log('Extension generation complete! Visit https://docs.flarum.org/extend to learn more about Flarume extension development.')
  }

  protected async emptyDirCheck(dir: string) {
    const files = filesystem.readdirSync(dir)

    const empty = files.length === 0 || (files.length === 1 && files[0] === '.git')

    if (empty) return

    const response = await prompts([
      {
        name: 'overwrite',
        type: 'confirm',
        message: 'Directory not empty. Overwrite?',
      },
    ], this.promptsOptions)

    if (response.overwrite === false) this.exit()

    this.fs.delete(`${dir}/!(*.git)`)
  }

  protected async setup(dir: string) {
    const response = await prompts(
      [
        {
          name: 'packageName',
          type: 'text',
          message: `Package ${chalk.dim('(vendor/extension-name)')}`,
          validate: s => /^([0-9a-zA-Z-]{2,})\/([0-9a-zA-Z-]{2,})$/.test(s.trim()) || 'Invalid package name format',
          format: s => s.toLowerCase(),
        },
        {
          name: 'packageDescription',
          type: 'text',
          message: 'Package description',
        },
        {
          name: 'namespace',
          type: 'text',
          message: `Package namespace ${chalk.dim('(Vendor\\ExtensionName)')}`,
          validate: s => /^([0-9a-zA-Z]+)\\([0-9a-zA-Z]+)$/.test(s.trim()) || 'Invalid namespace format',
          format: (str: string) =>
            str &&
            str
            .split('\\')
            .map(s => s[0].toUpperCase() + s.slice(1))
            .join('\\'),
        },
        {
          name: 'authorName',
          type: 'text',
          message: 'Author name',
        },
        {
          name: 'authorEmail',
          type: 'text',
          message: 'Author email',
          validate: s => !s || /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(s) || 'Invalid email format',
        },
        {
          name: 'license',
          type: 'autocomplete',
          message: 'License',
          choices: [...licenseList as Set<string>].map(e => ({title: e, value: e})),
        },
        {
          name: 'extensionName',
          type: 'text',
          message: 'Extension name',
          validate: str => Boolean(str.trim()) || 'The extension name is required',
          format: str =>
            str
            .split(' ')
            .map((s: string) => (s.length > 3 ? s[0].toUpperCase() + s.slice(1) : s))
            .join(' '),
        },
        {
          name: 'admin',
          type: 'confirm',
          message: 'Admin CSS & JS',
          initial: true,
        },
        {
          name: 'forum',
          type: 'confirm',
          message: 'Forum CSS & JS',
          initial: true,
        },
        {
          name: 'useLocale',
          type: 'confirm',
          message: 'Locale',
          initial: true,
        },
        {
          name: 'useJs',
          type: (prev, values) => (values.admin || values.forum) && 'confirm',
          message: 'Javascript',
          initial: true,
        },
        {
          name: 'useCss',
          type: (prev, values) => (values.admin || values.forum) && 'confirm',
          message: 'CSS',
          initial: true,
        },
      ],
      this.promptsOptions
    )

    cli.action.start('Setting up files...')

    const tpl = Object.assign(response, {
      packageNamespace: response.namespace.replace(/\\/, '\\\\'),
      year: new Date().getFullYear().toString(),
    })

    await (new BoilerplateBuilder(this.getCliDir(), dir, process.cwd()))
    .filesystemOp(Filesystems.InitExtension, (fs: Editor, fsUtil: MemFsUtil, cliDir: string, params: any) => {
      fs.copyTpl(path.resolve(cliDir, 'boilerplate', 'extension'), dir, params, undefined, {globOptions: {dot: true}})

      if (!params.useLocale) fsUtil.del('locale')
      if (!params.useJs) fsUtil.del('js')
      if (!params.useCss) fsUtil.del('less')
      if (!params.admin) {
        fsUtil.del('less/admin.less')
        fsUtil.del('js/src/admin')
        fsUtil.del('js/admin.js')
      }
      if (!params.forum) {
        if (params.useCss) fsUtil.del('less/app.less')
        if (params.useJs) {
          fsUtil.del('js/src/forum')
          fsUtil.del('js/forum.js')
        }
      }

      const license = require(`spdx-license-list/licenses/${params.license}`)
      this.fs.write(path.resolve(dir, 'LICENSE.md'), license.licenseText)
    }, tpl)
    .execute()
    cli.action.stop()
  }

  async installPackages(dir: string) {
    const response = await prompts([
      {
        name: 'composer',
        type: 'confirm',
        message: 'Run `composer install`? (recommended)',
        initial: true,
      },
      {
        name: 'npm',
        type: 'confirm',
        message: 'Run `npm install`? (recommended)',
        initial: true,
      },
    ], this.promptsOptions)

    if (!response.composer && !response.npm) return

    if (response.composer) {
      cli.action.start('Installing composer packages')
      execSync('composer install')
      cli.action.stop()
    }

    if (response.npm) {
      cli.action.start('Installing npm packages')
      execSync('npm install', {cwd: './js'})
      cli.action.stop()
    }
  }
}