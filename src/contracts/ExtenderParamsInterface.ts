export default interface ExtenderParams {
  extender: ExtenderSpec;
  methodCalls?: MethodCallSpec[];
}

export interface ExtenderSpec {
  className: string;
  args?: ArgSpec[];
}

export interface MethodCallSpec {
  methodName: string;
  args?: ArgSpec[];
}

export interface ArgSpec {
  type: ArgType,
  value: string | boolean | CallbackSpec;
  auxiliaryValue?: string;
}

export interface CallbackSpec {
  params: ParamSpec[];
  bodyComment: string;
}

export interface ParamSpec {
  type: string;
  name: string;
}

export enum ArgType {
  SCALAR = 'scalar',
  CLASS_CONST = 'class_const',
}
