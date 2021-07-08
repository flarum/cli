import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateJobStub extends BasePhpStubStep {
  type = 'Generate Job Class';

  protected schema = {
    recommendedSubdir: 'Job',
    sourceFile: 'backend/job.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: 'Job class name',
        validate: Validator.className,
      },
      {
        name: 'classNamespace',
        type: 'text',
      },
    ],
  }
}
