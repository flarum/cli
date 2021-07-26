import { glob } from 'glob';
import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { PhpProvider } from '../../provider/php-provider';
import { Step } from '../step-manager';

const IMPORTS_REGEX = /((^import\s+(?:([\w,{}\s*]+)\s+from)?\s*(?:(?:["'])?([@\w\s\\\/.-]+)\3?(?:["'])?)\s*;?\s*)*)(.*)/m;
const INIT_REGEX = /^(app\.initializers\.add\('[^']+',\s*\(\)\s*=>\s*\{)$/m;

export abstract class BaseJsStep implements Step {
  abstract type: string;

  composable = true;

  async run(fs: Store, pathProvider: PathProvider, paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
    const fsEditor = create(fs);

    let frontends = await paramProvider.get({ name: 'frontend', type: 'text' });

    if (frontends === 'common') {
      frontends = ['admin', 'forum'];
    } else {
      frontends = [frontends];
    }

    frontends.forEach(frontend => {
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
    });

    return fs;
  }

  protected abstract async getDefinition(): string;

  protected abstract async getImports(): string;

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
