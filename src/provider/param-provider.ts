import prompt, { PromptObject } from 'prompts';

export interface ParamProvider {
  /**
   * Retrie
   */
  get<T>(paramDef: ParamDef): Promise<T>;

  /**
   * Load a set of param values as initial values
   */
  reset(initial: { [key: string]: unknown }): void;
}

export type ParamDef = PromptObject;

export class PromptParamProvider implements ParamProvider {
  private cache = new Map<string, unknown>();

  async get<T>(paramDef: ParamDef): Promise<T> {
    const paramName = paramDef.name as string;

    if (this.cache.has(paramName)) {
      return this.cache.get(paramName) as T;
    }

    const res = await prompt(paramDef) as Record<string, unknown>;
    const resValue = res[paramName] as T;

    this.cache.set(paramName, resValue);

    return resValue;
  }

  reset(initial: { [key: string]: unknown }): void {
    this.cache = new Map(Object.entries(initial));
  }
}
