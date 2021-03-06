import chalk from 'chalk';
import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateApiControllerStub extends BasePhpStubStep {
  type = 'Generate Api Controller Class';

  protected additionalExposes = [];

  protected phpClassParams = ['serializerClass', 'handlerCommandClass'];

  protected schema = {
    recommendedSubdir: 'Api/Controller',
    sourceFile: 'backend/api-controller/${classType}.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: 'Api Controller class name',
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
        message: 'Api Controller type',
        choices: ['Normal', 'List', 'Show', 'Create', 'Update', 'Delete'].map((type: string) => ({
          title: type,
          value: type.toLowerCase(),
        })),
      },
      {
        name: 'serializerClass',
        type: 'text',
        message: `Serializer Class (${chalk.dim('Vendor\\Path\\Serializer')})`,
        validate: Validator.class,
      },
      {
        name: 'serializerClassName',
        type: 'text',
        message: 'Serializer class name',
      },
      {
        name: 'handlerCommandClass',
        type: 'text',
        message: `Handler Command Class (${chalk.dim('Vendor\\Path\\Command')}) (Optional)`,
        validate: Validator.optionalClass,
        optional: true,
      },
      {
        name: 'handlerCommandClassName',
        type: 'text',
        message: 'Handler command class name',
      },
    ],
  };
}
