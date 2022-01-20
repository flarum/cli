import chalk from 'chalk';
import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateHandlerCommandStub extends BasePhpStubStep {
  type = 'Generate Handler Class';

  protected additionalExposes = ['className', 'classType'];

  protected phpClassParams = [];

  protected schema = {
    recommendedSubdir: 'Command',
    sourceFile: 'backend/handler/command.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: `Handler Command class name (example: ${chalk.dim('EditModel')})`,
        validate: Validator.className,
      },
      {
        name: 'classNamespace',
        type: 'text',
        message: 'Class Namespace',
      },
      {
        name: 'classType',
        type: 'autocomplete',
        message: 'Class Type',
        choices: ['None', 'Create', 'Update', 'Delete'].map((type: string) => ({
          title: type,
          value: type.toLowerCase(),
        })),
      },
    ],
  };
}
