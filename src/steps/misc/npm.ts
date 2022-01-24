import { execSync } from 'node:child_process';
import { Store } from 'mem-fs';
import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { DefaultProviders, Step } from 'boilersmith/step-manager';

export class NpmInstall implements Step {
  type = 'Run npm install';

  composable = false;

  async run(fs: Store, paths: Paths, _paramProvider: IO, _providers: DefaultProviders): Promise<Store> {
    execSync('npm install', { cwd: paths.package('js') });

    return fs;
  }

  exposes = [];

  getExposed(): Record<string, unknown> {
    return {};
  }
}
