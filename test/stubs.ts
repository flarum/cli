import { Store } from 'mem-fs';
import { Editor } from 'mem-fs-editor';
import { ParamDef, ParamProvider } from '../src/provider/param-provider';
import { ExtenderDef, PhpProvider } from '../src/provider/php-provider';
import { Step } from '../src/steps/step-manager';

export function stubStepFactory(name: string, composable = true, paramsConsumed: ParamDef[] = []): Step {
  return {
    name,
    composable,
    async run(fs: Store, _fsEditor: Editor, paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
      paramsConsumed.forEach(paramProvider.get);

      return fs;
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
