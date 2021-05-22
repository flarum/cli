import prompt, { PromptObject } from 'prompts';

export type ParamDef = PromptObject;

export class ParamProvider {
  private cache = new Map<string, unknown>();

  constructor(initial: Record<string, unknown> = {}) {
    this.cache = new Map(Object.entries(initial));
  }

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
}
