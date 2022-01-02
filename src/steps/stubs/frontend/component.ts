import { Validator } from '../../../utils/validation';
import { BaseJsStubStep } from '../js-base';

export class GenerateComponentStub extends BaseJsStubStep {
  type = 'Generate a Component';

  protected additionalExposes = ['frontend'];

  protected schema = {
    recommendedSubdir: '${frontend}/components',
    sourceFile: 'frontend/component.js',
    params: [
      {
        name: 'frontend',
        type: 'text',
        message: 'Frontend name',
      },
      {
        name: 'className',
        type: 'text',
        message: 'Component class name',
        validate: Validator.className,
      },
      {
        name: 'classNamespace',
        type: 'text',
      },
    ],
  }
}
