import chalk from 'chalk';
import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateRepositoryStub extends BasePhpStubStep {
  type = 'Generate Repository Class';

  protected additionalExposes = ['modelClass', 'modelClassName'];

  protected phpClassParams = ['modelClass'];

  protected schema = {
    recommendedSubdir: '',
    sourceFile: 'backend/repository.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: 'Repository class name',
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
