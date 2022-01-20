import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { Validator } from '../../../utils/validation';
import { pluralSnakeCaseModel, pluralKebabCaseModel } from '../../../utils/model-name';
import { BasePhpStubStep } from '../php-base';
import { Store } from 'mem-fs';

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
        message: 'Class Namespace',
      },
      {
        name: 'tableName',
        type: 'text',
        message: 'Table name (Optional)',
        validate: Validator.tableName,
        optional: true,
      },
    ],
  };

  protected async compileParams(fs: Store, paths: Paths, io: IO): Promise<Record<string, unknown>> {
    const params = await super.compileParams(fs, paths, io);

    params.modelPluralSnake = pluralSnakeCaseModel(params.className as string);
    params.modelPluralKebab = pluralKebabCaseModel(params.className as string);

    if (!params.tableName) {
      params.tableName = params.modelPluralSnake;
    }

    params.migrationName = `create_${params.tableName}_table`;

    return params;
  }
}
