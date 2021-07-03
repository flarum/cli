import chalk from 'chalk';
import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateApiControllerStub extends BasePhpStubStep {
  type = 'Generate Api Controller Class';

  protected additionalExposes = [];

  protected phpClassParams = [];

  protected schema = {
    recommendedSubdir: 'Api/Controller',
    sourceFile: 'backend/api-controller.php',
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
        message: `Api Controller type`,
        choices: [
          {
            title: 'None',
            value: 'none',
          },
          {
            title: 'List',
            value: 'AbstractListController',
          },
          {
            title: 'Show',
            value: 'AbstractShowController',
          },
          {
            title: 'Create',
            value: 'AbstractCreateController',
          },
          {
            title: 'Delete',
            value: 'AbstractDeleteController',
          },
        ],
      },
    ],
  }
}
