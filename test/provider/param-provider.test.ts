import { prompt } from 'prompts';
import { PromptsIO } from 'boilersmith/io';

describe('IO Works', function () {
  it('Reads values from prompts properly', async function () {
    const provider = new PromptsIO();

    prompt.inject(['Test']);

    expect(await provider.getParam({ name: 'different1', type: 'text', message: '_' })).toStrictEqual('Test');
    expect(await provider.getParam({ name: 'different2', type: 'text', message: '_' })).toBeUndefined();
  });

  it('Obtains from cache if present', async function () {
    const provider = new PromptsIO();

    prompt.inject(['Test']);

    expect(await provider.getParam({ name: 'same', type: 'text', message: '_' })).toStrictEqual('Test');
    expect(await provider.getParam({ name: 'same', type: 'text', message: '_' })).toStrictEqual('Test');
  });

  it('Obtains from initial if present', async function () {
    const provider = new PromptsIO({ same: 'A', different: 'B' });

    expect(await provider.getParam({ name: 'same', type: 'text', message: '_' })).toStrictEqual('A');
    expect(await provider.getParam({ name: 'different', type: 'text', message: '_' })).toStrictEqual('B');
  });

  describe('#has', function () {
    it('Returns has if not in cache', function () {
      const provider = new PromptsIO();

      expect(provider.hasCached('something')).toBe(false);
    });

    it('Returns true if asked before', async function () {
      const provider = new PromptsIO();
      prompt.inject(['Test']);

      expect(await provider.getParam({ name: 'something', type: 'text', message: '_' })).toBe('Test');
      expect(provider.hasCached('something')).toBe(true);
    });

    it('Returns true if in initial', async function () {
      const provider = new PromptsIO({ something: 'Test' });

      expect(provider.hasCached('something')).toBe(true);
    });
  });

  describe('#cached', function () {
    it('Returns values from initial and prompted', async function () {
      const provider = new PromptsIO({ initial: 'A' });

      prompt.inject(['Test']);

      await provider.getParam({ name: 'prompted', type: 'text', message: '_' });

      expect(provider.cached()).toStrictEqual({
        initial: 'A',
        prompted: 'Test',
      });
    });
  });
});
