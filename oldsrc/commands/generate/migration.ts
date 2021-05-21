import cli from 'cli-ux'
import filesystem from 'fs'
import path from 'path'
import prompts from 'prompts'
import {Stubs} from '../../schemas/stubs'
import BaseFsCommand from '../../util/BaseFsCommand'
import BoilerplateBuilder from '../../util/BoilerplateBuilder'

export default class GenerateMigration extends BaseFsCommand {
  static description = 'generate an empty migration template';

  static flags = {...BaseFsCommand.flags};

  static args = [...BaseFsCommand.args];

  async run() {
    const {args, flags} = this.parse(GenerateMigration)

    const extDir = await this.getFlarumExtensionRoot(args.path)

    await this.confirmDir(extDir)

    const response = await prompts([
      {
        name: 'name',
        type: 'text',
        message: 'Migration name/short description',
        validate: s => /^[0-9a-zA-Z_ ]+$/.test(s.trim()) || 'Field is required; alphanumerical characters, underscores, and spaces only!',
        format: str => str.toLowerCase().replace(/ /g, '_'),
      },
    ], this.promptsOptions)

    cli.action.start('Implementing changes...')
    const ops = await (new BoilerplateBuilder(this.getCliDir(), extDir, process.cwd(), args.path))
    .stub(Stubs.Migration, {className: this.getNextMigrationName(extDir, response.name)})
    .execute()
    cli.action.stop()

    ops.forEach(this.log.bind(this))
    this.log('Please make sure to check my work, adjust formatting, and test before commiting!!!')
  }

  protected getNextMigrationName(dir: string, name: string): string {
    const migrations = filesystem.readdirSync(path.resolve(dir, 'migrations'))

    let number = 0

    for (const migration of migrations.sort().reverse()) {
      const match = migration.match(/^(\d{4})_(\d{2})_(\d{2})_(\d{6})_(.*)\.php/)
      if (!match) continue

      const now = new Date()

      if (parseInt(match[1]) === now.getFullYear() && parseInt(match[2]) === now.getMonth() + 1 && parseInt(match[3]) === now.getDate()) {
        number = parseInt(match[4]) + 1
      }
    }

    const now = new Date()

    const pad = (val: number, len: number) => String(val).padStart(len, '0')

    return `${pad(now.getFullYear(), 4)}_${pad(now.getMonth() + 1, 2)}_${pad(now.getDate(), 2)}_${pad(number, 6)}_${name}.php`
  }
}
