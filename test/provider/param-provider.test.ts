import { prompt } from 'prompts';
import { ParamProvider } from '../../src/provider/param-provider';

describe('ParamProvider Works', function () {
  it('Reads values from prompts properly', async function () {
    const provider = new ParamProvider();

    prompt.inject(['Test']);

    expect(await provider.get({ name: 'different1', type: 'text', message: '_' })).toStrictEqual('Test');
    expect(await provider.get({ name: 'different2', type: 'text', message: '_' })).toStrictEqual(undefined);
  });

  it('Obtains from cache if present', async function () {
    const provider = new ParamProvider();

    prompt.inject(['Test']);

    expect(await provider.get({ name: 'same', type: 'text', message: '_' })).toStrictEqual('Test');
    expect(await provider.get({ name: 'same', type: 'text', message: '_' })).toStrictEqual('Test');
  });

  it('Obtains from initial if present', async function () {
    const provider = new ParamProvider({ same: 'A', different: 'B' });

    expect(await provider.get({ name: 'same', type: 'text', message: '_' })).toStrictEqual('A');
    expect(await provider.get({ name: 'different', type: 'text', message: '_' })).toStrictEqual('B');
  });

  describe('#has', function () {
    it('Returns has if not in cache', function () {
      const provider = new ParamProvider();

      expect(provider.has('something')).toBe(false);
    });

    it('Returns true if asked before', async function () {
      const provider = new ParamProvider();
      prompt.inject(['Test']);

      expect(await provider.get({ name: 'something', type: 'text', message: '_' })).toBe('Test');
      expect(provider.has('something')).toBe(true);
    });

    it('Returns true if in initial', async function () {
      const provider = new ParamProvider({ something: 'Test' });

      expect(provider.has('something')).toBe(true);
    });
  });

  describe('#cached', function () {
    it('Returns values from initial and prompted', async function () {
      const provider = new ParamProvider({ initial: 'A' });

      prompt.inject(['Test']);

      await provider.get({ name: 'prompted', type: 'text', message: '_' });

      expect(provider.cached()).toStrictEqual({
        initial: 'A',
        prompted: 'Test',
      });
    });
  });
});
