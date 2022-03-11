import { Store } from 'mem-fs';
import { Paths } from 'boilersmith/paths';
import { create } from 'mem-fs-editor';

export function npmPath(name: string): string {
  return `js-packages/${name}`;
}

export function composerPath(name: string): string {
  return `php-packages/${name}`;
}

export function extensionPath(name: string): string {
  return `extensions/${name}`;
}

export function corePath(_name: string): string {
  return 'framework/core';
}

type PackageInfo = {
  name: string;
  gitRemote: string;

  /**
   * Defaults to `main`.
   */
  mainBranch?: string;
};

export type FlarumMonorepoJsonSchema = {
  packages: {
    core?: PackageInfo;
    extensions: PackageInfo[];
    composer?: PackageInfo[];
    npm?: PackageInfo[];
  };
};

export function getMonorepoConf(fs: Store, paths: Paths): FlarumMonorepoJsonSchema {
  return create(fs).readJSON(paths.package('flarum-monorepo.json')) as FlarumMonorepoJsonSchema;
}
