import { glob } from 'glob';
import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { PhpProvider } from '../../provider/php-provider';
import { Step } from '../step-manager';

const IMPORTS_REGEX = /((^import\s+(?:([\s\w*,{}]+)\s+from)?\s*["']?([\s\w./@\\-]+)\3?["']?\s*;?\s*)*)(.*)/m;
const INIT_REGEX = /^(app\.initializers\.add\('[^']+',\s*\(\)\s*=>\s*{)$/m;

export abstract class BaseJsStep implements Step {
  abstract type: string;

  composable = true;

  async run(fs: Store, pathProvider: PathProvider, paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
    const fsEditor = create(fs);

    const frontend: string = await paramProvider.get({ name: 'frontend', type: 'text' });
    let frontends: string[] = [frontend];

    if (frontend === 'common') {
      frontends = ['admin', 'forum'];
    }

    for (const frontend of frontends) {
      const fsSrcFilePaths = glob.sync(pathProvider.ext(`js/src/${frontend}/*.{js,jsx,ts,tsx}`));

      fsSrcFilePaths.forEach(async match => {
        /**
         * @TODO look into using https://esprima.org/ instead
         */

        const currContents = fsEditor.read(match);

        const imports = await this.getImports(frontend, pathProvider, paramProvider);
        const definition = await this.getDefinition(paramProvider);

        const newContents = currContents
          .replace(INIT_REGEX, `$1\n  ${definition}\n`)
          .replace(IMPORTS_REGEX, `$1${imports}\n\n$5`);

        fsEditor.write(match, newContents);
      });
    }

    return fs;
  }

  protected abstract async getDefinition(paramProvider: ParamProvider): Promise<string>;

  protected abstract async getImports(frontend: string, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<string>;

  protected importPath(frontend: string, classNamespace: string): string {
    let path = `../${classNamespace}`;

    path = path.replace(`../${frontend}/`, './');

    return path;
  }

  exposes = [];

  getExposed(_pathProvider: PathProvider, _paramProvider: ParamProvider): Record<string, unknown> {
    return {};
  }
}
