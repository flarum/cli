/* eslint-disable no-template-curly-in-string */
import { Validator } from '../../../utils/validation';
import { BaseJsStubStep } from '../js-base';

export class GenerateModelStub extends BaseJsStubStep {
  type = 'Generate Model Class';

  protected additionalExposes = [];

  protected schema = {
    recommendedSubdir: '${frontend}/models',
    sourceFile: 'frontend/model.js',
    params: [
      {
        name: 'frontend',
        type: 'text',
        message: 'Frontend name',
      },
      {
        name: 'className',
        type: 'text',
        message: 'Model class name',
        validate: Validator.className,
      },
    ],
  }
}
