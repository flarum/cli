import chalk from 'chalk';
import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateCommandStub extends BasePhpStubStep {
  type = 'Generate a command class';

  protected additionalExposes = [];

  protected phpClassParams = [];

  protected schema = {
    recommendedSubdir: 'Console',
    sourceFile: 'backend/command.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: 'Command class name',
        validate: Validator.className,
      },
      {
        name: 'classNamespace',
        type: 'text',
      },
      {
        name: 'commandName',
        type: 'text',
        message: `Command name (${chalk.dim('namespace:command')})`,
        validate: Validator.commandName,
      },
      {
        name: 'commandDescription',
        type: 'text',
        message: 'Command description',
      },
    ],
  }
}
