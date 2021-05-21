import { prompt } from 'prompts';
import { PromptParamProvider } from '../../src/steps/prompt-param-provider';

describe('param provider', function () {
  test('Reads values from prompts properly', async function () {
    const provider = new PromptParamProvider();

    prompt.inject(['Test']);

    expect(await provider.get({ name: 'different1', type: 'text', message: '_' })).toStrictEqual('Test');
    expect(await provider.get({ name: 'different2', type: 'text', message: '_' })).toStrictEqual(undefined);
  });

  test('Obtains from cache if present', async function () {
    const provider = new PromptParamProvider();

    prompt.inject(['Test']);

    expect(await provider.get({ name: 'same', type: 'text', message: '_' })).toStrictEqual('Test');
    expect(await provider.get({ name: 'same', type: 'text', message: '_' })).toStrictEqual('Test');
  });

  test('Resetting resets cache as expected', async function () {
    const provider = new PromptParamProvider();

    prompt.inject(['Test']);

    expect(await provider.get({ name: 'same', type: 'text', message: '_' })).toStrictEqual('Test');
    provider.reset({});
    expect(await provider.get({ name: 'same', type: 'text', message: '_' })).toStrictEqual(undefined);
  });

  test('Resetting can inject new values', async function () {
    const provider = new PromptParamProvider();

    prompt.inject(['Test']);

    expect(await provider.get({ name: 'same', type: 'text', message: '_' })).toStrictEqual('Test');
    provider.reset({same: 'Some value'});
    expect(await provider.get({ name: 'same', type: 'text', message: '_' })).toStrictEqual('Some value');
  });
});
