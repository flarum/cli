import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateIntegrationTestStub extends BasePhpStubStep {
  type = 'Generate Integration Test Class';

  protected additionalExposes = [];

  protected phpClassParams = [];

  protected schema = {
    root: './tests',
    recommendedSubdir: 'integration.api',
    sourceFile: 'backend/integration-test.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: 'Test class name',
        validate: Validator.className,
      },
      {
        name: 'classNamespace',
        type: 'text',
        message: 'Class Namespace',
      },
      {
        name: 'extensionId',
        type: 'text',
        message: 'Extension Id',
      },
    ],
  };
}
