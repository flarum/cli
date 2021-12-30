import { Store } from 'mem-fs';
import { resolve } from 'node:path';
import { ParamDef, ParamProvider } from 'boilersmith/param-provider';
import { PathProvider } from 'boilersmith/path-provider';
import { ExtenderDef, PhpProvider } from '../../src/provider/php-provider';
import { Step } from 'boilersmith/step-manager';

export function stubStepFactory(type: string, composable = true, paramsConsumed: ParamDef[] = [], paramsExposed: Record<string, unknown> = {}): Step {
  return {
    type,
    composable,
    exposes: Object.keys(paramsExposed),
    async run(fs: Store, _pathProvider: PathProvider, paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
      paramsConsumed.forEach(paramProvider.get);

      return fs;
    },
    getExposed(_pathProvider: PathProvider, _paramProvider: ParamProvider): Record<string, unknown> {
      return paramsExposed;
    },
  };
}

interface TestPaths {
  cwd?: string;

  boilerplate?: string;

  ext?: string;

  requestedDir?: string|null;
}

export function stubPathProviderFactory(paths: TestPaths = {}): PathProvider {
  return {
    cwd(...path: string[]): string {
      return resolve(paths.cwd || '/cwd', ...path);
    },

    boilerplate(...path: string[]): string {
      return resolve(paths.boilerplate || '/boilerplate', ...path);
    },

    ext(...path: string[]): string {
      return resolve(paths.ext || '/ext', ...path);
    },

    requestedDir(...path: string[]): string|null {
      return paths.requestedDir ? resolve(paths.requestedDir, ...path) : null;
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
