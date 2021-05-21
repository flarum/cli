import { Store } from 'mem-fs';
import { Editor } from 'mem-fs-editor';
import { PromptObject } from 'prompts';

export interface Step {
  name: string;

  composable: boolean;

  run: (fs: Store, fsEditor: Editor, paramProvider: ParamProvider) => Promise<Store>;
}

export type StepParamDef = PromptObject;

export interface ParamProvider {
  /**
   * Retrie
   */
  get<T>(paramDef: StepParamDef): Promise<T>;

  /**
   * Load a set of param values as initial values
   */
  reset(initial: { [key: string]: unknown }): void;
}
