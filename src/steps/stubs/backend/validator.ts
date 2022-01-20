import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateValidatorStub extends BasePhpStubStep {
  type = 'Generate Validator Class';

  protected schema = {
    recommendedSubdir: '',
    sourceFile: 'backend/validator.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: 'Validator class name',
        validate: Validator.className,
      },
      {
        name: 'classNamespace',
        type: 'text',
      },
    ],
  };
}
