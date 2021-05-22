import { prompt } from 'prompts';
import { ParamProvider } from '../../src/provider/param-provider';

describe('ParamProvider Works', function () {
  test('Reads values from prompts properly', async function () {
    const provider = new ParamProvider();

    prompt.inject(['Test']);

    expect(await provider.get({ name: 'different1', type: 'text', message: '_' })).toStrictEqual('Test');
    expect(await provider.get({ name: 'different2', type: 'text', message: '_' })).toStrictEqual(undefined);
  });

  test('Obtains from cache if present', async function () {
    const provider = new ParamProvider();

    prompt.inject(['Test']);

    expect(await provider.get({ name: 'same', type: 'text', message: '_' })).toStrictEqual('Test');
    expect(await provider.get({ name: 'same', type: 'text', message: '_' })).toStrictEqual('Test');
  });

  test('Obtains from initial if present', async function () {
    const provider = new ParamProvider({same: 'A', different: 'B'});

    expect(await provider.get({ name: 'same', type: 'text', message: '_' })).toStrictEqual('A');
    provider.reset({});
    expect(await provider.get({ name: 'different', type: 'text', message: '_' })).toStrictEqual('B');
  });
});
