import { create as createMemFs, Store } from 'mem-fs';
import { create as createMemFsEditor } from 'mem-fs-editor';
import { resolve } from 'node:path';
import { prompt } from 'prompts';
import { ParamDef, PromptsIO, IO} from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { Step } from 'boilersmith/step-manager';

export function stubStepFactory<Providers extends {} = {}>(type: string, composable = true, paramsConsumed: ParamDef[] = [], paramsExposed: Record<string, unknown> = {}): Step<Providers> {
  return {
    type,
    composable,
    exposes: Object.keys(paramsExposed),
    async run(fs: Store, _paths: Paths, io: IO, _providers: Providers): Promise<Store> {
      paramsConsumed.forEach(io.getParam);

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
  };
}


const empty = {};

interface StepOutput {
  fs: Store;
  exposedParams: Record<string, unknown>;
}

export async function runStep<Providers extends {} = {}>(
  step: Step<Providers>,
  providers: Providers,
  params: unknown[] = [],
  initialParams: Record<string, unknown> = {},
  initialFilesCallback: (paths: Paths) => Record<string, string> = () => empty,
  requestedDir: string|null = null,
): Promise<StepOutput> {
  const fs = createMemFs();
  const paths = stubPathsFactory({ requestedDir });
  prompt.inject(params);
  const io = new PromptsIO(initialParams);

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
  return store.all().filter(f => f.state && f.state !== 'deleted').map(f => f.path)
    .filter((path: string) => path.startsWith(extDir))
    .sort();
}

export function getExtFileContents(fs: Store, path: string): string {
  const fsEditor = createMemFsEditor(fs);
  return fsEditor.read(resolve('/ext', path));
}
