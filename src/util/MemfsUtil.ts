import * as path from 'path';
import { Editor } from 'mem-fs-editor';

export class MemFsUtil {
  fs: Editor;
  baseDir: string;

  constructor(fs: Editor, baseDir: string) {
    this.fs = fs;
    this.baseDir = baseDir;
  }

  mv(from: string, to: string) {
    this.fs.move(path.resolve(this.baseDir, from), path.resolve(this.baseDir, to));
  }

  del(f: string) {
    this.fs.delete(path.resolve(this.baseDir, f));
  }

  exists(f: string) {
    return this.fs.exists(path.resolve(this.baseDir, f));
  }
}
