import { readdirSync } from 'fs';
import { Store } from 'mem-fs';
import { Editor } from 'mem-fs-editor';
import { ParamProvider } from '../../../provider/param-provider';
import { PathProvider } from '../../../provider/path-provider';
import { Validator } from '../../../utils/validation';
import { getNextMigrationName } from '../../../utils/migration';
import { BasePhpStubStep } from '../php-base';

export class GenerateMigrationStub extends BasePhpStubStep {
  type = 'Generate Migration';

  protected schema = {
    root: './',
    recommendedSubdir: 'migrations',
    forceRecommendedSubdir: true,
    sourceFile: 'migration.php',
    params: [
      {
        name: 'name',
        type: 'text',
        message: 'Migration name/short description',
        validate: Validator.migrationName,
      },
    ],
  }

  protected async compileParams(fsEditor: Editor, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const params = await super.compileParams(fsEditor, pathProvider, paramProvider);

    const regex = new RegExp(/^create_([A-z0-9_]+)_table$/);

    if (regex.test(params.name as string)) {
      params.tableName = regex.exec(params.name as string)?.pop();
    }

    return params;
  }

  protected async getFileName(fs: Store, pathProvider: PathProvider, _paramProvider: ParamProvider) {
    let persistedMigrations: string[];
    try {
      persistedMigrations = readdirSync(pathProvider.ext('migrations'));
    } catch {
      persistedMigrations = [];
    }
    const memMigrations: string[] = fs.all().map(f => f.path).filter(p => p.startsWith(pathProvider.ext('migrations')));

    return getNextMigrationName([...persistedMigrations, ...memMigrations], this.params.name as string) + '.php';
  }
}
