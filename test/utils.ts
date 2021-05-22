import { create as createMemFs, Store } from 'mem-fs';
import { create as createMemFsEditor } from 'mem-fs-editor';
import { resolve } from 'path';
import { Step } from '../src/steps/step-manager';
import { stubParamProviderFactory, stubPathProviderFactory, stubPhpProviderFactory } from './stubs';

export async function runStep(StepClass: any, params: Record<string, unknown>): Promise<Store> {
  const step: Step = new StepClass();

  const fs = createMemFs();
  const pathProvider = stubPathProviderFactory({boilerplate: resolve(__dirname, '../boilerplate')});
  const paramProvider = stubParamProviderFactory(params);
  const phpProvider = stubPhpProviderFactory();

  return step.run(fs, pathProvider, paramProvider, phpProvider);
}

export function getFsPaths(store: Store, extDir = '/ext'): string[] {
  // TODO: update when issues with mem-fs typings resolved.
  // @ts-ignore
  return store.all().filter(f => f.state !== 'deleted').map(f => f.path)
    .filter((path: string) => path.startsWith(extDir))
    .sort();
}

export function getExtFileContents(fs: Store, path: string): string {
  const fsEditor = createMemFsEditor(fs);
  return fsEditor.read(resolve('/ext', path));
}
