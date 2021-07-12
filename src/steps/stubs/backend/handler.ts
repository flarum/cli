import chalk from 'chalk';
import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateHandlerStub extends BasePhpStubStep {
  type = 'Generate Handler Class';

  protected additionalExposes = [];

  protected phpClassParams = ['handlerCommandClass'];

  protected schema = {
    recommendedSubdir: 'Command',
    sourceFile: 'backend/handler/handler.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: `Handler class name (example: ${chalk.dim('EditModelHandler')})`,
        validate: Validator.className,
      },
      {
        name: 'classNamespace',
        type: 'text',
      },
      {
        name: 'handlerCommandClass',
        type: 'text',
        message: `Handler Command class (${chalk.dim('Vendor\\Path\\Command')})`,
        validate: Validator.className,
      },
      {
        name: 'handlerCommandClassName',
        type: 'text',
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
  }
}
