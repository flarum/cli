import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

/**
 * The factory a model's tests fill it from. It sits next to the model, named
 * after it, which is where Flarum looks for a model's factory.
 */
export class GenerateModelFactoryStub extends BasePhpStubStep {
  type = 'Generate Model Factory Class';

  protected schema = {
    recommendedSubdir: '',
    sourceFile: 'backend/model-factory.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: 'Factory class name',
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
