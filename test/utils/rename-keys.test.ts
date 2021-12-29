import { renameKeys } from '../../src/utils/rename-keys';


describe('rename-keys', function () {
  it('works', function() {
      const renamed = renameKeys({a: 'test', b: 'test2'}, k => `--${k}`);

      expect(renamed).toStrictEqual({
          '--a': 'test',
          '--b': 'test2'
      });
  })
});
