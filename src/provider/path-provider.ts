import { resolve } from 'path';

export interface PathProvider {
  cwd(path: string): string;

  ext(path: string): string;

  boilerplate(path: string): string;

  requestedDir(path: string): string;
}

interface Paths {
  ext: string;

  requestedDir?: string;
}

export class PathFsProvider implements PathProvider {
  private paths: Paths;

  constructor(paths: Paths) {
    this.paths = paths;
  }

  cwd(path: string): string {
    return resolve(process.cwd(), path);
  }

  ext(path: string): string {
    return resolve(this.paths.ext, path);
  }

  boilerplate(path: string): string {
    return resolve(__dirname, '../../boilerplate', path);
  }

  requestedDir(path: string): string {
    if (!this.paths.requestedDir) return this.cwd(path);

    return resolve(this.paths.requestedDir, path);
  }
}
