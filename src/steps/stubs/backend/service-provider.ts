import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateServiceProviderStub extends BasePhpStubStep {
  type = 'Generate Service Provider Class';

  protected schema = {
    recommendedSubdir: '',
    sourceFile: 'backend/service-provider.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: 'Provider class name',
        validate: Validator.className,
      },
      {
        name: 'classNamespace',
        type: 'text',
      },
    ],
  };
}
