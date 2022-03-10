import { execSync } from 'child_process';
import { Store } from 'mem-fs';
import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { DefaultProviders, Step } from 'boilersmith/step-manager';

export class YarnInstall implements Step {
  type = 'Run yarn install';

  composable = false;

  async run(fs: Store, paths: Paths, _paramProvider: IO, _providers: DefaultProviders): Promise<Store> {
    execSync('yarn install', { cwd: paths.package('js') });

    return fs;
  }

  exposes = [];

  getExposed(): Record<string, unknown> {
    return {};
  }
}
