import prompt, { Options, PromptObject } from 'prompts';
import { exit } from '@oclif/errors';

export type ParamDef = Omit<PromptObject, 'name'> & { name: string };

export const PROMPTS_OPTIONS: Options = { onCancel: () => exit() };

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

    const res = (await prompt(paramDef, PROMPTS_OPTIONS)) as Record<string, unknown>;
    const resValue = res[paramName] as T;

    this.cache.set(paramName, resValue);

    return resValue;
  }

  has(name: string): boolean {
    return this.cache.has(name);
  }

  /**
   * @internal
   */
  cached(): Record<string, unknown> {
    return [...this.cache].reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {} as Record<string, unknown>);
  }
}

export type ParamProviderFactory = (initial: Record<string, unknown>) => ParamProvider;

export const paramProviderFactory: ParamProviderFactory = (initial = {}) => {
  return new ParamProvider(initial);
};
