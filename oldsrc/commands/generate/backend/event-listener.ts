import chalk from 'chalk'
import cli from 'cli-ux'
import path from 'path'
import prompts from 'prompts'
import {Extenders} from '../../../schemas/extenders'
import {Stubs} from '../../../schemas/stubs'
import BaseFsCommand from '../../../util/BaseFsCommand'
import BoilerplateBuilder from '../../../util/BoilerplateBuilder'
import Validator from '../../../util/Validator'

export default class GenerateBackendEventListener extends BaseFsCommand {
  static description = 'generate an event listener';

  static flags = {...BaseFsCommand.flags};

  static args = [...BaseFsCommand.args];

  async run() {
    const {args, flags} = this.parse(GenerateBackendEventListener)

    const extDir = await this.getFlarumExtensionRoot(args.path)

    await this.confirmDir(extDir)

    const response = await prompts([
      {
        name: 'eventClass',
        type: 'text',
        message: `Event Class (${chalk.dim('Vendor\\Path\\Event')})`,
        validate: Validator.class,
      },
      {
        name: 'className',
        type: 'text',
        message: 'Listener class name',
        validate: Validator.className,
      },
    ], this.promptsOptions)

    cli.action.start('Implementing changes...')
    const ops = await (new BoilerplateBuilder(this.getCliDir(), extDir, process.cwd(), args.path))
    .stub(Stubs.EventListener, response)
    .groupWith((builder: BoilerplateBuilder, parentParams: any) => {
      builder.extender(Extenders.EventListen, {})
    })
    .execute()
    cli.action.stop()

    ops.forEach(this.log.bind(this))
    this.log('Please make sure to check my work, adjust formatting, and test before commiting!!!')
  }
}
