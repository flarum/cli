import { create as createMemFs, Store } from 'mem-fs';
import { create as createMemFsEditor } from 'mem-fs-editor';
import { resolve } from 'node:path';
import { prompt } from 'prompts';
import { ParamProvider } from '../src/provider/param-provider';
import { PathProvider } from '../src/provider/path-provider';
import { Step } from '../src/steps/step-manager';
import { stubPathProviderFactory, stubPhpProviderFactory } from './stubs';

const empty = {};

interface StepOutput {
  fs: Store;
  exposedParams: Record<string, unknown>;
}

export async function runStep(
  step: Step,
  params: unknown[] = [],
  initialParams: Record<string, unknown> = {},
  initialFilesCallback: (pathProvider: PathProvider) => Record<string, string> = () => empty,
  requestedDir: string|null = null,
): Promise<StepOutput> {
  const fs = createMemFs();
  const pathProvider = stubPathProviderFactory({ boilerplate: resolve(__dirname, '../boilerplate'), requestedDir });
  prompt.inject(params);
  const paramProvider = new ParamProvider(initialParams);
  const phpProvider = stubPhpProviderFactory();

  const fsEditor = createMemFsEditor(fs);
  const initialFiles = initialFilesCallback(pathProvider);
  for (const path of Object.keys(initialFiles)) {
    fsEditor.write(path, initialFiles[path]);
  }

  const newFs = await step.run(fs, pathProvider, paramProvider, phpProvider);
  const exposedParams = step.getExposed(pathProvider, paramProvider);

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
