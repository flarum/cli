import chalk from 'chalk';
import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GeneratePolicyStub extends BasePhpStubStep {
  type = 'Generate a policy Class';

  protected additionalExposes = ['modelClass', 'modelClassName'];

  protected phpClassParams = ['modelClass'];

  protected schema = {
    recommendedSubdir: 'Access',
    sourceFile: 'backend/policy.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: 'Policy class name',
        validate: Validator.className,
      },
      {
        name: 'classNamespace',
        type: 'text',
      },
      {
        name: 'modelClass',
        type: 'text',
        message: `Model Class (${chalk.dim('Vendor\\Path\\Model')})`,
        validate: Validator.class,
      },
      {
        name: 'modelClassName',
        type: 'text',
      },
    ],
  };
}
