import chalk from 'chalk';
import cli from 'cli-ux';
import filesystem from 'fs';
import path from 'path';
import prompts from 'prompts';
import ExtenderParams, { ArgType } from '../../../contracts/ExtenderParamsInterface';
import BaseGenerateCommand from '../../../util/BaseGenerateCommand';

export default class GenerateBackendEventListener extends BaseGenerateCommand {
  static description = 'generate an event listener';

  static flags = { ...BaseGenerateCommand.flags };

  static args = [...BaseGenerateCommand.args];

  async run() {
    const { args, flags } = this.parse(GenerateBackendEventListener);

    const extDir = await this.getFlarumExtensionRoot(args.path);

    await this.confirmDir(extDir);

    const data = await this.prompt(extDir);

    const subPath = 'src/Listener';

    data.namespace = [data.packageNamespace.replace("\\", ""), this.subPathToPhpNamespace(subPath)].join("\\");
    data.fullyQualifiedClassName = `\\${data.namespace}\\${data.className}`;

    await this.stub(extDir, subPath, data);

    await this.extender(extDir, subPath, data);

    await this.fsCommit(extDir);

    this.log(`New event listener added at ${path.resolve(extDir, subPath, `${data.className}.php`)}`);
    this.log('Please make sure to check my work, adjust formatting, and test before commiting!!!');
  }

  protected async prompt(extDir: string) {
    const response = await prompts([
      {
        name: 'eventClass',
        type: 'text',
        message: `Event Class (${chalk.dim("\\Vendor\\Path\\Event")})`,
        validate: this.validateClassNameFullyQualified
      },
      {
        name: 'className',
        type: 'text',
        message: `Listener class name`,
        validate: this.validateClassName
      },
    ], this.promptsOptions);

    return Object.assign(this.simulateInitPromptData(extDir), response);
  }

  protected async stub(extDir: string, subPath: string, data: any) {
    cli.action.start('Generating listener stub...');

    const stubDir = this.getCliDir('stubs/backend');

    data.eventClassFullyQualified = data.eventClass.replace("\\", "");
    data.eventClassShort = data.eventClass.split('\\').slice(-1);

    this.fs.copyTpl(path.resolve(stubDir, 'event-listener.php'), path.resolve(extDir, subPath, `${data.className}.php`), data);

    cli.action.stop();
  }

  protected async extender(extDir: string, subPath: string, data: any) {
    cli.action.start('Updating extend.php...');
    const params: ExtenderParams = {
      extender: {
        className: '\\Flarum\\Extend\\Event'
      },
      methodCalls: [
        {
          methodName: 'listen',
          args: [
            {
              type: ArgType.CLASS_CONST,
              value: data.eventClass,
              auxiliaryValue: 'class'
            },
            {
              type: ArgType.CLASS_CONST,
              value: data.fullyQualifiedClassName,
              auxiliaryValue: 'class'
            }
          ]
        }
      ]
    }

    const newExtendPhp = await this.addExtender(extDir, params);

    this.fs.write(path.resolve(extDir, 'extend.php'), newExtendPhp);
    cli.action.stop();
  }
}
