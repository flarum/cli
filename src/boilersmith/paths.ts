import { resolve } from 'path';

export interface Paths {
  cwd(...path: string[]): string;

  package(...path: string[]): string;

  requestedDir(...path: string[]): string | null;

  monorepo(...path: string[]): string | null;

  onMonorepoSub(packagePath: string, monorepoPath?: string): Paths;
}

type InternalPaths = {
  package: string;
  monorepo?: string | null;
  requestedDir?: string | null;
};

export class NodePaths implements Paths {
  protected paths: InternalPaths;

  constructor(paths: InternalPaths) {
    this.paths = paths;
  }

  cwd(...path: string[]): string {
    return resolve(process.cwd(), ...path);
  }

  package(...path: string[]): string {
    return resolve(this.paths.package, ...path);
  }

  requestedDir(...path: string[]): string | null {
    if (!this.paths.requestedDir) return null;

    return resolve(this.paths.requestedDir, ...path);
  }

  monorepo(...path: string[]): string | null {
    if (!this.paths.monorepo) return null;

    return resolve(this.paths.monorepo, ...path);
  }

  onMonorepoSub(packagePath: string, monorepoPath?: string): NodePaths {
    return new NodePaths({ ...this.paths, monorepo: monorepoPath ?? this.paths.package, package: packagePath });
  }
}
