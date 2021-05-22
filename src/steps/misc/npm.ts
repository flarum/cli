import { execSync } from 'child_process';
import { Store } from 'mem-fs';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { PhpProvider } from '../../provider/php-provider';
import { Step } from '../step-manager';

export class NpmInstall implements Step {
  name = 'Run NPM install';

  composable = false;

  async run(fs: Store, pathProvider: PathProvider, _paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
    execSync('npm install', { cwd: pathProvider.ext('js') });

    return fs;
  }
}
