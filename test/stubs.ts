import { Store } from 'mem-fs';
import { resolve } from 'path';
import { ParamDef, ParamProvider } from '../src/provider/param-provider';
import { PathProvider } from '../src/provider/path-provider';
import { ExtenderDef, PhpProvider } from '../src/provider/php-provider';
import { Step } from '../src/steps/step-manager';

export function stubStepFactory(name: string, composable = true, paramsConsumed: ParamDef[] = []): Step {
  return {
    name,
    composable,
    async run(fs: Store, _pathProvider: PathProvider, paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
      paramsConsumed.forEach(paramProvider.get);

      return fs;
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

export function stubParamProviderFactory(initial: Record<string, unknown>): ParamProvider {
  return {
    async get<T>(paramDef: ParamDef): Promise<T> {
      return initial[paramDef.name as string] as T;
    },

    reset() {
      // No cache, so do nothing.
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
