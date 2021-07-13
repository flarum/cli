/* eslint-disable no-warning-comments */
import chalk from 'chalk';
import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateHandlerStub extends BasePhpStubStep {
  type = 'Generate Handler Class';

  protected additionalExposes = [];

  protected additionalImplicitParams = ['repositoryClass', 'repositoryClassName', 'validatorClass', 'validatorClassName'];

  protected phpClassParams = ['handlerCommandClass', 'repositoryClass', 'validatorClass'];

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
        name: 'repositoryClass', // TODO: This type of parameter is a bit of a mess
        message: '',
        optional: true,
        type: 'text',
      },
      {
        name: 'repositoryClassName',
        type: 'text',
      },
      {
        name: 'validatorClass',
        message: '',
        optional: true,
        type: 'text',
      },
      {
        name: 'validatorClassName',
        type: 'text',
      },
    ],
  }
}
