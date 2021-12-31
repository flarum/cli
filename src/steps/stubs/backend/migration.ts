import { readdirSync } from 'node:fs';
import { Store } from 'mem-fs';
import { Editor } from 'mem-fs-editor';
import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
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

  protected async compileParams(fsEditor: Editor, paths: Paths, io: IO): Promise<Record<string, unknown>> {
    const params = await super.compileParams(fsEditor, paths, io);

    const regex = new RegExp(/^create_([\dA-z]+)_table$/);

    if (regex.test(params.name as string)) {
      params.tableName = regex.exec(params.name as string)?.pop();
    }

    return params;
  }

  protected async getFileName(fs: Store, paths: Paths, _paramProvider: IO): Promise<string> {
    let persistedMigrations: string[];
    try {
      persistedMigrations = readdirSync(paths.package('migrations'));
    } catch {
      persistedMigrations = [];
    }

    const memMigrations: string[] = fs.all().map(f => f.path).filter(p => p.startsWith(paths.package('migrations')));

    return getNextMigrationName([...persistedMigrations, ...memMigrations], this.params.name as string) + '.php';
  }
}
