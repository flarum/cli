import { execSync } from 'node:child_process';
import { Store } from 'mem-fs';
import { ParamProvider } from 'boilersmith/param-provider';
import { PathProvider } from 'boilersmith/path-provider';
import { PhpProvider } from '../../provider/php-provider';
import { Step } from 'boilersmith/step-manager';

export class YarnInstall implements Step {
  type = 'Run yarn install';

  composable = false;

  async run(fs: Store, pathProvider: PathProvider, _paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
    execSync('yarn install', { cwd: pathProvider.ext('js') });

    return fs;
  }

  exposes = [];

  getExposed(): Record<string, unknown> {
    return {};
  }
}
