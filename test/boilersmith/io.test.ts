import prompts from 'prompts';
import { PromptsIO } from 'boilersmith/io';

describe('PromptsIO Tests', function () {
  it('Uses prompts in interaction mode', async function () {
    prompts.inject(['val']);

    const io = new PromptsIO();

    expect(
      await io.getParam<boolean>({
        message: 'get param',
        type: 'text',
        name: 'something',
      })
    ).toBe('val');
  });

  it('Returns initial in noInteraction mode', async function () {
    const io = new PromptsIO({}, [], true);

    expect(
      await io.getParam<string>({
        message: 'get param',
        type: 'text',
        name: 'something',
        initial: 'default',
      })
    ).toBe('default');
  });

  it('Errors when no initial in noInteraction mode', async function () {
    const io = new PromptsIO({}, [], true);

    expect(
      async () =>
        io.getParam<string>({
          message: 'get param',
          type: 'text',
          name: 'something',
        }),
    ).rejects.toThrow('No-Interaction mode is on, but input is required for param "something".');
  });

  it('Confirm in no interaction defaults to false even without initial', async function () {
    const io = new PromptsIO({}, [], true);

    expect(
      await io.getParam<boolean>({
        message: 'get param',
        type: 'confirm',
        name: 'something',
      }),
    ).toBe(false);
  });

  it('Toggle in no interaction defaults to false even without initial', async function () {
    const io = new PromptsIO({}, [], true);

    expect(
      await io.getParam<boolean>({
        message: 'get param',
        type: 'toggle',
        name: 'something',
      }),
    ).toBe(false);
  });
});
