import { execSync } from 'node:child_process';
import { Store } from 'mem-fs';
import { ParamProvider } from 'boilersmith/param-provider';
import { PathProvider } from 'boilersmith/path-provider';
import { PhpProvider } from '../../provider/php-provider';
import { Step } from 'boilersmith/step-manager';

export class ComposerInstall implements Step {
  type = 'Run composer install/update';

  composable = false;

  async run(fs: Store, pathProvider: PathProvider, _paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
    execSync('composer update', { cwd: pathProvider.ext('') });

    return fs;
  }

  exposes = [];

  getExposed(): Record<string, unknown> {
    return {};
  }
}
