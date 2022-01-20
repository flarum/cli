import { resolve } from 'node:path';
import { readTpl } from 'boilersmith/utils/read-tpl';

describe('read-tpl', function () {
  it('errors when data missing', function () {
    expect(() => {
      readTpl(resolve(__dirname, '../fixtures.sample.tpl'), {});
    }).toThrow();
  });

  it('works with data provided', function () {
    const content = readTpl(resolve(__dirname, '../fixtures/sample.tpl'), { requiredMessage: 'Flarum is great!' });

    expect(content).toStrictEqual('Hello world!\n\nFlarum is great!');
  });
});
