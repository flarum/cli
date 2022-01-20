import { Validator } from '../../../utils/validation';
import { BaseJsStubStep } from '../js-base';

export class GenerateModalStub extends BaseJsStubStep {
  type = 'Generate Modal Component';

  protected additionalExposes = ['frontend'];

  protected schema = {
    recommendedSubdir: '${frontend}/components',
    sourceFile: 'frontend/modal.js',
    params: [
      {
        name: 'frontend',
        type: 'text',
        message: 'Frontend name',
      },
      {
        name: 'className',
        type: 'text',
        message: 'Modal class name',
        validate: Validator.className,
      },
      {
        name: 'classNamespace',
        type: 'text',
        message: 'Class Namespace',
      },
    ],
  };
}
