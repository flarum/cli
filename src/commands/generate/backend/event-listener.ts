import BaseFsCommand from '../../../util/BaseFsCommand';

export default class GenerateBackendEventListener extends BaseFsCommand {
  static description = 'generate an event listener';

  static flags = { ...BaseFsCommand.flags };

  static args = [...BaseFsCommand.args];

  async run() {
    const { args, flags } = this.parse(GenerateBackendEventListener)

    const extDir = await this.getFlarumExtensionRoot(args.path);

    const output = await this.modifyExtend(extDir, 'event_listen', {'event': 'fdsfadssdafdsafsa\\sadfdsafsadfas'});

    this.log(output);
  }
}
