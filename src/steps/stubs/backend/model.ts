import { Editor } from 'mem-fs-editor';
import { ParamProvider } from 'boilersmith/param-provider';
import { PathProvider } from 'boilersmith/path-provider';
import { Validator } from '../../../utils/validation';
import { pluralSnakeCaseModel, pluralKebabCaseModel } from '../../../utils/model-name';
import { BasePhpStubStep } from '../php-base';

export class GenerateModelStub extends BasePhpStubStep {
  type = 'Generate Model Class';

  protected additionalExposes = ['className', 'migrationName', 'modelPluralSnake', 'modelPluralKebab'];

  protected phpClassParams = [];

  protected schema = {
    recommendedSubdir: '',
    sourceFile: 'backend/model.php',
    params: [
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
      {
        name: 'tableName',
        type: 'text',
        message: 'Table name (Optional)',
        validate: Validator.tableName,
        optional: true,
      },
    ],
  }

  protected async compileParams(fsEditor: Editor, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const params = await super.compileParams(fsEditor, pathProvider, paramProvider);

    params.modelPluralSnake = pluralSnakeCaseModel(params.className as string);
    params.modelPluralKebab = pluralKebabCaseModel(params.className as string);

    if (!params.tableName) {
      params.tableName = params.modelPluralSnake;
    }

    params.migrationName = `create_${params.tableName}_table`;

    return params;
  }
}
