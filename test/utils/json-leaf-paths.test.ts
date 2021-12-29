import { jsonLeafPaths } from '../../src/utils/json-leaf-paths';

describe('json-leaf-paths', function () {
  describe('non-nested', function () {
    it('works with null', function () {
      const paths = jsonLeafPaths(null);

      expect(paths).toStrictEqual(['']);
    });

    it('works with number', function () {
      const paths = jsonLeafPaths(5);

      expect(paths).toStrictEqual(['']);
    });

    it('works with string', function () {
      const paths = jsonLeafPaths('hello world');

      expect(paths).toStrictEqual(['']);
    });

    it('works with boolean', function () {
      const paths = jsonLeafPaths(true);

      expect(paths).toStrictEqual(['']);
    });

    it('works with object', function () {
      const paths = jsonLeafPaths({
        hello: 'world',
        foo: 'bar',
      });

      expect(paths).toStrictEqual(['hello', 'foo']);
    });

    it('doesnt look for leaves in arrays', function () {
      const paths = jsonLeafPaths(['hello', 'world', 'foo', 'bar']);

      expect(paths).toStrictEqual([]);
    });
  });

  it('works with complex nested objects', function () {
    const paths = jsonLeafPaths({
      hello: 'world',
      'hyphenated-path': {
        hi: true,
        foo: 'bar',
        spam: ['monty', 'python', { holy: 'grail', chose: 'wisely' }],
        more: {
          nested: {
            deeper: {
              than: {
                reasonable: null,
                number: 5,
              },
            },
          },
        },
      },
    });

    expect(paths).toStrictEqual([
      'hello',
      'hyphenated-path.hi',
      'hyphenated-path.foo',
      'hyphenated-path.more.nested.deeper.than.reasonable',
      'hyphenated-path.more.nested.deeper.than.number',
    ]);
  });
});
