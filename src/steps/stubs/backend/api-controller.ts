/* eslint-disable no-template-curly-in-string */
import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateApiControllerStub extends BasePhpStubStep {
  type = 'Generate Api Controller Class';

  protected additionalExposes = [];

  protected phpClassParams = [];

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
    ],
  }
}
