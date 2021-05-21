import prompt from 'prompts';
import { ParamProvider, StepParamDef } from '../contracts/step';

export class PromptParamProvider implements ParamProvider {
  private cache = new Map<string, unknown>();

  async get<T>(paramDef: StepParamDef): Promise<T> {
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
