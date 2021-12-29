import { ParamDef } from 'src/provider/param-provider';

export interface PromptTemplateParam<T> {
  /**
   * A config object to prompt for the param's value.
   * Also contains the param name.
   */
  prompt: ParamDef;

  // getCurrVal: (pathProvider: PathProvider) => Promise<T>
}

export interface ComputedTemplateParam<T> {
  name: string;

  uses: string[];

  compute: (...args: any[]) => T;
}

export type TemplateParam<T> = PromptTemplateParam<T> | ComputedTemplateParam<T>;

export function isComputedParam<T>(param: TemplateParam<T>): param is ComputedTemplateParam<T> {
    return 'uses' in param;
}

export function getParamName<T>(param: TemplateParam<T>) {
    return isComputedParam(param) ? param.name : param.prompt.name;
};
