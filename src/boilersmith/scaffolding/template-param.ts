import { Store } from 'mem-fs';
import { ParamDef, IO } from 'boilersmith/io';
import { Paths } from '../paths';

interface PromptTemplateParam<T, N extends string = string> {
  /**
   * A config object to prompt for the param's value.
   * Also contains the param name.
   */
  prompt: ParamDef<N>;

  getCurrVal: (fs: Store, paths: Paths) => Promise<T>;
}

interface ComputedTemplateParam<T, N extends string = string> {
  name: N;

  uses: string[];

  compute: (paths: Paths, ...args: any[]) => Promise<T>;
}

export type TemplateParam<T, N extends string = string> = PromptTemplateParam<T, N> | ComputedTemplateParam<T, N>;

export function isPromptParam<T, N extends string>(param: TemplateParam<T, N>): param is PromptTemplateParam<T, N> {
  return 'prompt' in param;
}

export function isComputedParam<T, N extends string>(param: TemplateParam<T, N>): param is ComputedTemplateParam<T, N> {
  return 'uses' in param;
}

export function getParamName<T, N extends string>(param: TemplateParam<T, N>): N {
  return isComputedParam(param) ? param.name : param.prompt.name;
}

async function withComputedParamValues(params: TemplateParam<unknown>[], paths: Paths, paramVals: Record<string, unknown>): Promise<Record<string, unknown>> {
  const vals = { ...paramVals };

  const computedParams = params.filter(isComputedParam);

  for (const p of computedParams) {
    const depValues = p.uses.map((key) => vals[key]);

    vals[p.name] = await p.compute(paths, ...depValues);
  }

  return vals;
}

export async function promptParamValues(params: TemplateParam<unknown>[], paths: Paths, io: IO): Promise<Record<string, unknown>> {
  const promptParams = params.filter(isPromptParam);
  const paramVals: Record<string, unknown> = {};

  for (const p of promptParams) {
    paramVals[p.prompt.name] = await io.getParam(p.prompt);
  }

  return withComputedParamValues(params, paths, paramVals);
}

export async function currParamValues(params: TemplateParam<unknown>[], fs: Store, paths: Paths) {
  const promptParams = params.filter(isPromptParam);
  const paramVals: Record<string, unknown> = {};

  for (const p of promptParams) {
    paramVals[p.prompt.name] = await p.getCurrVal(fs, paths);
  }

  return withComputedParamValues(params, paths, paramVals);
}
