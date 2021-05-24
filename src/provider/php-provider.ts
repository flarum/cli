import { execSync } from 'child_process';

export interface ExtenderDef {
  extender: ExtenderSpec;
  methodCalls?: MethodCallSpec[];
}

export interface ExtenderSpec {
  className: string;
  args?: ExpressionSpec[];
}

export interface MethodCallSpec {
  methodName: string;
  args?: ExpressionSpec[];
}

export interface ExpressionSpec {
  type: ExpressionType;
  value: string | boolean | ClosureSpec;
  auxiliaryValue?: string;
}

export interface ClosureSpec {
  params: ParamSpec[];
  return?: ExpressionSpec;
}

export interface ParamSpec {
  typeType: ParamTypeType;
  type: string;
  name: string;
}

export enum ExpressionType {
  SCALAR = 'scalar',
  CLASS_CONST = 'class_const',
  CLOSURE = 'closure',
  VARIABLE = 'variable',
}

export enum ParamTypeType {
  CLASS = 'class',
  PRIMITIVE = 'primitive',
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
