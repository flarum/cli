import { Store } from 'mem-fs';
import { resolve } from 'path';
import { ParamDef, ParamProvider } from '../src/provider/param-provider';
import { PathProvider } from '../src/provider/path-provider';
import { ExtenderDef, PhpProvider } from '../src/provider/php-provider';
import { Step } from '../src/steps/step-manager';

export function stubStepFactory(name: string, composable = true, paramsConsumed: ParamDef[] = [], paramsExposed: Record<string, unknown> = {}): Step {
  return {
    name,
    composable,
    exposes: Object.keys(paramsExposed),
    async run(fs: Store, _pathProvider: PathProvider, paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
      paramsConsumed.forEach(paramProvider.get);

      return fs;
    },
    getExposed(_pathProvider: PathProvider): Record<string, unknown> {
      return paramsExposed;
    },
  };
}

interface TestPaths {
  cwd?: string;

  boilerplate?: string;

  ext?: string;

  requestedDir?: string;
}

export function stubPathProviderFactory(paths: TestPaths = {}): PathProvider {
  return {
    cwd(path: string): string {
      return resolve(paths.cwd || '/cwd', path);
    },

    boilerplate(path: string): string {
      return resolve(paths.boilerplate || '/boilerplate', path);
    },

    ext(path: string): string {
      return resolve(paths.ext || '/ext', path);
    },

    requestedDir(path: string): string {
      return resolve(paths.requestedDir || '/ext', path);
    },
  };
}

export function stubPhpProviderFactory(): PhpProvider {
  return {
    withExtender(extendContents: string, _extenderDef: ExtenderDef): string {
      return extendContents;
    },
  };
}
