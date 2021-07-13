import chalk from 'chalk';
import { Editor } from 'mem-fs-editor';
import { ParamProvider } from '../../../provider/param-provider';
import { PathProvider } from '../../../provider/path-provider';
import { Validator } from '../../../utils/validation';
import { pluralSnakeCaseModel } from '../../../utils/model-name';
import { BasePhpStubStep } from '../php-base';

export class GenerateApiSerializerStub extends BasePhpStubStep {
  type = 'Generate Api Serializer Class';

  protected additionalExposes = ['className', 'modelClass', 'modelClassName'];

  protected additionalImplicitParams = ['modelType'];

  protected phpClassParams = ['modelClass'];

  protected schema = {
    recommendedSubdir: 'Api/Serializer',
    sourceFile: 'backend/api-serializer.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: 'Serializer class name',
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
      {
        name: 'modelType',
        type: 'text',
      },
    ],
  }

  protected async compileParams(fsEditor: Editor, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const params = await super.compileParams(fsEditor, pathProvider, paramProvider);

    params.modelType = pluralSnakeCaseModel(params.modelClassName as string);

    return params;
  }
}
