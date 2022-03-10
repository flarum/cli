import { create as createMemFs, Store } from 'mem-fs';
import { create as createMemFsEditor } from 'mem-fs-editor';
import { resolve } from 'path';
import { prompt } from 'prompts';
import { ParamDef, PromptsIO, IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { DefaultProviders, Step } from 'boilersmith/step-manager';

export function stubStepFactory<Providers extends DefaultProviders>(
  type: string,
  composable = true,
  paramsConsumed: ParamDef[] = [],
  paramsExposed: Record<string, unknown> = {}
): Step<Providers> {
  return {
    type,
    composable,
    exposes: Object.keys(paramsExposed),
    async run(fs: Store, _paths: Paths, io: IO, _providers: Providers): Promise<Store> {
      paramsConsumed.forEach((prompt) => io.getParam(prompt));

      return fs;
    },
    getExposed(_paths: Paths, _paramProvider: IO): Record<string, unknown> {
      return paramsExposed;
    },
  };
}

interface TestPaths {
  cwd?: string;

  package?: string;

  requestedDir?: string | null;

  monorepo?: string;
}

export function stubPathsFactory(paths: TestPaths = {}): Paths {
  return {
    cwd(...path: string[]): string {
      return resolve(paths.cwd || '/cwd', ...path);
    },

    package(...path: string[]): string {
      return resolve(paths.package || '/ext', ...path);
    },

    requestedDir(...path: string[]): string | null {
      return paths.requestedDir ? resolve(paths.requestedDir, ...path) : null;
    },

    monorepo(...path: string[]): string | null {
      return paths.monorepo ? resolve(paths.monorepo, ...path) : null;
    },

    onMonorepoSub(packagePath: string): Paths {
      return stubPathsFactory({ ...paths, monorepo: paths.package, package: packagePath });
    },
  };
}

const empty = {};

interface StepOutput {
  fs: Store;
  exposedParams: Record<string, unknown>;
}

class CacheIO extends PromptsIO {
  async getParam<T>(paramDef: ParamDef<string>): Promise<T> {
    if (!this.cache.has(paramDef.name)) throw new Error(`No value for param ${paramDef.name}`);
    return this.cache.get(paramDef.name) as T;
  }
}

type IOConf =
  | { initialParams: Record<string, unknown>; usePrompts: false }
  | { initialParams: Record<string, unknown>; usePrompts: true; paramVals: unknown[]; noInteraction?: boolean };

export async function runStep<Providers extends DefaultProviders>(
  step: Step<Providers>,
  providers: Providers,
  // eslint-disable-next-line unicorn/no-object-as-default-parameter
  ioConf: IOConf = { initialParams: {}, usePrompts: false },
  initialFilesCallback: (paths: Paths) => Record<string, string> = () => empty,
  requestedDir: string | null = null
): Promise<StepOutput> {
  const fs = createMemFs();
  const paths = stubPathsFactory({ requestedDir });
  if (ioConf.usePrompts) {
    prompt.inject(ioConf.paramVals);
  }

  const io = ioConf.usePrompts ? new PromptsIO(ioConf.initialParams, [], ioConf.noInteraction) : new CacheIO(ioConf.initialParams);

  const fsEditor = createMemFsEditor(fs);
  const initialFiles = initialFilesCallback(paths);
  for (const path of Object.keys(initialFiles)) {
    fsEditor.write(path, initialFiles[path]);
  }

  const newFs = await step.run(fs, paths, io, providers);
  const exposedParams = step.getExposed(paths, io);

  return { fs: newFs, exposedParams };
}

export function getFsPaths(store: Store, extDir = '/ext'): string[] {
  return store
    .all()
    .filter((f) => f.state && f.state !== 'deleted')
    .map((f) => f.path)
    .filter((path: string) => path.startsWith(extDir))
    .sort();
}

export function getExtFileContents(fs: Store, path: string): string {
  const fsEditor = createMemFsEditor(fs);
  return fsEditor.read(resolve('/ext', path));
}
