import { execSync } from 'node:child_process';
import { Store } from 'mem-fs';
import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { DefaultProviders, Step } from 'boilersmith/step-manager';

export class ComposerInstall implements Step {
  type = 'Run composer install/update';

  composable = false;

  async run(fs: Store, paths: Paths, _paramProvider: IO, _providers: DefaultProviders): Promise<Store> {
    execSync('composer update', { cwd: paths.package('') });

    return fs;
  }

  exposes = [];

  getExposed(): Record<string, unknown> {
    return {};
  }
}
