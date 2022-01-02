import { Store } from 'mem-fs';
import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { DefaultProviders, Step } from 'boilersmith/step-manager';
import simpleGit from 'simple-git';

export class GitInit implements Step {
  type = 'Run git init';

  composable = false;

  async run(fs: Store, _paths: Paths, _paramProvider: IO, _providers: DefaultProviders): Promise<Store> {
    simpleGit().init();

    return fs;
  }

  exposes = [];

  getExposed(): Record<string, unknown> {
    return {};
  }
}
