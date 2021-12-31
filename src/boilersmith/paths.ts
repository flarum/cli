import { resolve } from 'node:path';

export interface Paths {
  cwd(...path: string[]): string;

  package(...path: string[]): string;

  requestedDir(...path: string[]): string|null;

  monorepo(...path: string[]): string|null;
}

type InternalPaths = {
  package: string;
  monorepo?: string|null;
  requestedDir?: string|null;
}

export class NodePaths implements Paths {
  private paths: InternalPaths;

  constructor(paths: InternalPaths) {
    this.paths = paths;
  }

  cwd(...path: string[]): string {
    return resolve(process.cwd(), ...path);
  }

  package(...path: string[]): string {
    return resolve(this.paths.package, ...path);
  }

  requestedDir(...path: string[]): string|null {
    if (!this.paths.requestedDir) return null;

    return resolve(this.paths.requestedDir, ...path);
  }

  monorepo(...path: string[]): string|null {
    if (!this.paths.monorepo) return null;

    return resolve(this.paths.monorepo, ...path);
  }
}
