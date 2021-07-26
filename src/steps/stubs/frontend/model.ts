/* eslint-disable no-template-curly-in-string */
import { Editor } from 'mem-fs-editor';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { Validator } from '../../../utils/validation';
import { BaseJsStubStep } from '../js-base';
import { pluralSnakeCaseModel } from '../../../utils/model-name';

export class GenerateModelStub extends BaseJsStubStep {
  type = 'Generate Model Class';

  protected additionalExposes = ['frontend', 'modelPluralSnake', 'classNamespace'];

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
      {
        name: 'classNamespace',
        type: 'text',
      },
    ],
  }

  protected async compileParams(fsEditor: Editor, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const params = await super.compileParams(fsEditor, pathProvider, paramProvider);

    params.modelPluralSnake = pluralSnakeCaseModel(params.className as string);

    return params;
  }
}
