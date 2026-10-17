import { parse as babelParse, ParseResult } from '@babel/parser';
import * as t from '@babel/types';
import getBabelOptions from 'recast/parsers/_babel_options';

/**
 * Recast's babel-ts parser, which also accepts an export of a name it can't see
 * declared, as Prettier does. Babel reports one for every `export { name }` in
 * an ambient `declare module` block, which is valid TypeScript. The upgrade
 * rewrites code rather than checking it: the extension's own build does that.
 */
export function parse(source: string): ParseResult<t.File> {
  const options = getBabelOptions();

  options.plugins.push('jsx', 'typescript');

  return babelParse(source, { ...options, allowUndeclaredExports: true });
}
