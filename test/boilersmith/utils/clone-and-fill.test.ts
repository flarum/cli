import { cloneAndFill } from 'boilersmith/utils/clone-and-fill';

describe('clone-and-fill', function () {
  it('Doesnt affect empty string', function () {
    expect(cloneAndFill('', {})).toStrictEqual('');
  });

  it('Fills string', function () {
    expect(cloneAndFill('Hello ${some}', { some: 'world' })).toStrictEqual('Hello world');
  });

  it('Fills array', function () {
    expect(cloneAndFill(['Hello ${some}', 'something else', 'FOO${foo}'], { some: 'world', foo: 'bar' })).toStrictEqual([
      'Hello world',
      'something else',
      'FOObar',
    ]);
  });

  it('Fills object', function () {
    expect(cloneAndFill({ key1: 'Hello ${some}', key2: 'something else', key3: 'FOO${foo}' }, { some: 'world', foo: 'bar' })).toStrictEqual({
      key1: 'Hello world',
      key2: 'something else',
      key3: 'FOObar',
    });
  });

  it('Fills complex nested object', function () {
    const original = {
      array: [{ name: '${NAME}' }, { key: 3, something: ['${HELLO}'] }],
      foo: 3,
      spam: 'monty',
      flarum: ['is', 'the', '${best}est', { soft: '${Ware}' }],
    };

    const params = {
      NAME: 'Franz',
      HELLO: 'luceos',
      best: 'Sycho',
      Ware: 'Toby',
    };

    const expected = {
      array: [{ name: 'Franz' }, { key: 3, something: ['luceos'] }],
      foo: 3,
      spam: 'monty',
      flarum: ['is', 'the', 'Sychoest', { soft: 'Toby' }],
    };

    expect(cloneAndFill(original, params)).toStrictEqual(expected);
  });
});
