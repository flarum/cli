import { Data, Options, render } from 'ejs';
import { readFileSync } from 'fs';

export function readTpl(path: string, data: Data, options?: Options): string {
  const template = readFileSync(path, 'utf8');

  return render(template, data, { filename: path, ...options, async: false });
}
