import globby from 'globby';
import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { Step } from 'boilersmith/step-manager';
import { FlarumProviders } from '../../providers';

const IMPORTS_REGEX = /((^import\s+(?:([\s\w*,{}]+)\s+from)?\s*["']?([\s\w./@\\-]+)\3?["']?\s*;?\s*)*)(.*)/m;
const INIT_REGEX = /^(app\.initializers\.add\('[^']+',\s*\(\)\s*=>\s*{)$/m;

export abstract class BaseJsStep implements Step<FlarumProviders> {
  abstract type: string;

  composable = true;

  async run(fs: Store, paths: Paths, io: IO, _providers: FlarumProviders): Promise<Store> {
    const fsEditor = create(fs);

    const frontend: string = await io.getParam({ name: 'frontend', type: 'text' });
    let frontends: string[] = [frontend];

    if (frontend === 'common') {
      frontends = ['admin', 'forum'];
    }

    for (const frontend of frontends) {
      const fsSrcFilePaths = globby.sync(paths.package(`js/src/${frontend}/*.{js,jsx,ts,tsx}`));

      fsSrcFilePaths.forEach(async match => {
        /**
         * @TODO look into using https://esprima.org/ instead
         */

        const currContents = fsEditor.read(match);

        const imports = await this.getImports(frontend, paths, io);
        const definition = await this.getDefinition(io);

        const newContents = currContents
          .replace(INIT_REGEX, `$1\n  ${definition}\n`)
          .replace(IMPORTS_REGEX, `$1${imports}\n\n$5`);

        fsEditor.write(match, newContents);
      });
    }

    return fs;
  }

  protected abstract getDefinition(io: IO): Promise<string>;

  protected abstract getImports(frontend: string, paths: Paths, io: IO): Promise<string>;

  protected importPath(frontend: string, classNamespace: string): string {
    let path = `../${classNamespace}`;

    path = path.replace(`../${frontend}/`, './');

    return path;
  }

  exposes = [];

  getExposed(_paths: Paths, _paramProvider: IO): Record<string, unknown> {
    return {};
  }
}
