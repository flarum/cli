import { Store } from 'mem-fs';
import { Editor } from 'mem-fs-editor';
import { ParamProvider, Step, StepParamDef } from '../src/contracts/step';

export function stubStepFactory(name: string, composable = true, paramsConsumed: StepParamDef[] = []): Step {
  return {
    name,
    composable,
    async run(fs: Store, _fsEditor: Editor, paramProvider: ParamProvider): Promise<Store> {
      paramsConsumed.forEach(paramProvider.get);

      return fs;
    },
  };
}

export function stubParamProviderFactory(initial: Record<string, unknown>): ParamProvider {
  return {
    async get<T>(paramDef: StepParamDef): Promise<T> {
      return initial[paramDef.name as string] as T;
    },

    reset() {
      // No cache, so do nothing.
    },
  };
}
