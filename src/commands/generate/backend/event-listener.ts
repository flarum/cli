import ExtenderParams, { ArgType } from '../../../contracts/ExtenderParamsInterface';
import BaseFsCommand from '../../../util/BaseFsCommand';

export default class GenerateBackendEventListener extends BaseFsCommand {
  static description = 'generate an event listener';

  static flags = { ...BaseFsCommand.flags };

  static args = [...BaseFsCommand.args];

  async run() {
    const { args, flags } = this.parse(GenerateBackendEventListener)

    const extDir = await this.getFlarumExtensionRoot(args.path);

    const params: ExtenderParams = {
      extender: {
        className: 'Extend\\Event'
      },
      methodCalls: [
        {
          methodName: 'listen',
          args: [
            {
              type: ArgType.CLASS_CONST,
              value: '\\Flarum\\Post\\Saving',
              auxiliaryValue: 'class'
            },
            {
              type: ArgType.CLASS_CONST,
              value: '\\Some\\Listener',
              auxiliaryValue: 'class'
            }
          ]
        }
      ]
    }

    const output = await this.addExtender(extDir, params);

    this.log(output);
  }
}
