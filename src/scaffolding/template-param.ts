import { Store } from 'mem-fs';
import { ParamDef, ParamProvider } from 'src/provider/param-provider';
import { PathProvider } from 'src/provider/path-provider';

interface PromptTemplateParam<T> {
  /**
   * A config object to prompt for the param's value.
   * Also contains the param name.
   */
  prompt: ParamDef;

  getCurrVal: (fs: Store, pathProvider: PathProvider) => Promise<T>;
}

interface ComputedTemplateParam<T> {
  name: string;

  uses: string[];

  compute: (...args: any[]) => T;
}

export type TemplateParam<T> = PromptTemplateParam<T> | ComputedTemplateParam<T>;

export function isPromptParam<T>(param: TemplateParam<T>): param is PromptTemplateParam<T> {
  return 'prompt' in param;
}

export function isComputedParam<T>(param: TemplateParam<T>): param is ComputedTemplateParam<T> {
  return 'uses' in param;
}

export function getParamName<T>(param: TemplateParam<T>) {
  return isComputedParam(param) ? param.name : param.prompt.name;
}

async function withComputedParamValues(params: TemplateParam<unknown>[], paramVals: Record<string, unknown>): Promise<Record<string, unknown>> {
  const vals = { ...paramVals };

  const computedParams = params.filter(isComputedParam);

  for (const p of computedParams) {
    const depValues = p.uses.map((key) => vals[key]);

    vals[p.name] = await p.compute(...depValues);
  }

  return vals;
}

export async function promptParamValues(params: TemplateParam<unknown>[], paramProvider: ParamProvider): Promise<Record<string, unknown>> {
  const promptParams = params.filter(isPromptParam);
  const paramVals: Record<string, unknown> = {};

  for (const p of promptParams) {
    paramVals[p.prompt.name] = await paramProvider.get(p.prompt);
  }

  return withComputedParamValues(params, paramVals);
}

export async function currParamValues(params: TemplateParam<unknown>[], fs: Store, pathProvider: PathProvider) {
  const promptParams = params.filter(isPromptParam);
  const paramVals: Record<string, unknown> = {};

  for (const p of promptParams) {
    paramVals[p.prompt.name] = await p.getCurrVal(fs, pathProvider);
  }

  return withComputedParamValues(params, paramVals);
}
