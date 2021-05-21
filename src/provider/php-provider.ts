import { execSync } from 'child_process';

export interface ExtenderDef {
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
  type: ArgType;
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

export interface PhpProvider {
  withExtender(extendContents: string, extenderDef: ExtenderDef): string;
}

export class PhpSubsystemProvider implements PhpProvider {
  protected phpPath: string;

  constructor(phpPath: string) {
    this.phpPath = phpPath;
  }

  withExtender(extendContents: string, extenderDef: ExtenderDef): string {
    const input = JSON.stringify({
      'extend.php': extendContents,
      op: 'extender.add',
      params: extenderDef,
    });

    const res = execSync(`php ${this.phpPath}`, { input });

    return res.toString();
  }
}
