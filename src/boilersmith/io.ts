import prompt, { Options, PromptObject } from 'prompts';
import { exit } from '@oclif/errors';

export type ParamDef<N extends string = string> = Omit<PromptObject<N>, 'name'> & { name: N };

export interface IO {
  getParam<T>(param: ParamDef): Promise<T>;

  hasCached(name: string): boolean;

  cached(): Record<string, unknown>;
}

export const PROMPTS_OPTIONS: Options = { onCancel: () => exit() };

export class PromptsIO implements IO {
  private cache = new Map<string, unknown>();

  constructor(initial: Record<string, unknown> = {}) {
    this.cache = new Map(Object.entries(initial));
  }

  async getParam<T>(paramDef: ParamDef): Promise<T> {
    const paramName = paramDef.name as string;

    if (this.cache.has(paramName)) {
      return this.cache.get(paramName) as T;
    }

    const res = (await prompt(paramDef, PROMPTS_OPTIONS)) as Record<string, unknown>;
    const resValue = res[paramName] as T;

    this.cache.set(paramName, resValue);

    return resValue;
  }

  hasCached(name: string): boolean {
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

export type IOFactory = (initial: Record<string, unknown>) => IO;

export const promptsIOFactory: IOFactory = (initial = {}) => {
  return new PromptsIO(initial);
};
