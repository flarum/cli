import { Editor } from 'mem-fs-editor';
import pluralize from 'pluralize';
import s from 'string';
import { ParamProvider } from '../../../provider/param-provider';
import { PathProvider } from '../../../provider/path-provider';
import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateModelStub extends BasePhpStubStep {
  type = 'Generate Model Class';

  protected additionalExposes = ['migrationName'];

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
        message: 'Table Name (Optional)',
        validate: Validator.tableName,
        optional: true,
      },
    ],
  }

  protected async compileParams(fsEditor: Editor, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const params = await super.compileParams(fsEditor, pathProvider, paramProvider);

    if (!params.tableName) {
      params.tableName = s(params.className).underscore().toString();
      params.tableName = pluralize((params.tableName as string).replace('_', ' ')).replace(' ', '_');
    }

    params.migrationName = `create_${params.tableName}_table`;

    return params;
  }
}
