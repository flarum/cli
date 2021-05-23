import { readdirSync } from 'fs';
import { Store } from 'mem-fs';
import { ParamProvider } from 'src/provider/param-provider';
import { PathProvider } from 'src/provider/path-provider';
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
        validate: (s: string) => /^[0-9a-zA-Z_ ]+$/.test(s.trim()) || 'Field is required; alphanumerical characters, underscores, and spaces only!',
      },
    ],
  }

  protected async getFileName(fs: Store, pathProvider: PathProvider, _paramProvider: ParamProvider) {
    let persistedMigrations: string[];
    try {
      persistedMigrations = readdirSync(pathProvider.ext('migrations'));
    } catch {
      persistedMigrations = [];
    }
    const memMigrations: string[] = fs.all().map(f => f.path).filter(p => p.startsWith(pathProvider.ext('migrations')));

    return getNextMigrationName([...persistedMigrations, ...memMigrations], this.params.name as string);
  }
}
