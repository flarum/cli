import { StepManager } from '../../src/steps/step-manager';
import { stubParamProviderFactory, stubStepFactory } from '../stubs';

describe('StepManager', function () {
  describe('Single step', function () {
    test('Can add and run single step', async function () {
      const paramProvider = stubParamProviderFactory({});
      const stepManager = new StepManager(paramProvider);
      const step = stubStepFactory('Step');

      stepManager.step(step);

      expect(await stepManager.run()).toStrictEqual(['Step']);
    });

    test('Single optional step will run if confirmed', async function () {
      const paramProvider = stubParamProviderFactory({ execute_step: true });
      const stepManager = new StepManager(paramProvider);
      const step = stubStepFactory('Optional Step');

      stepManager.step(step, true);

      expect(await stepManager.run()).toStrictEqual(['Optional Step']);
    });

    test('Single optional step wont run if not confirmed', async function () {
      const paramProvider = stubParamProviderFactory({ execute_step: false });
      const stepManager = new StepManager(paramProvider);
      const step = stubStepFactory('Optional Step');

      stepManager.step(step, true);

      expect(await stepManager.run()).toStrictEqual([]);
    });
  });

  describe('Composed Steps', function () {
    test('Errors when trying to compose non-composable steps', async function () {
      const paramProvider = stubParamProviderFactory({});
      const stepManager = new StepManager(paramProvider);

      expect(() => {
        stepManager.composedSteps([
          stubStepFactory('Step 1'),
          stubStepFactory('Step 2', false),
          stubStepFactory('Step 3'),
        ]);
      }).toThrow('The step "Step 2" is not composable.');
    });

    test('Can add and run single composed step', async function () {
      const paramProvider = stubParamProviderFactory({});
      const stepManager = new StepManager(paramProvider);

      stepManager.composedSteps([
        stubStepFactory('Step 1'),
        stubStepFactory('Step 2'),
        stubStepFactory('Step 3'),
      ]);

      expect(await stepManager.run()).toStrictEqual(['Composition of Step 1, Step 2, Step 3']);
    });

    test('Single composed optional step will run if confirmed', async function () {
      const paramProvider = stubParamProviderFactory({ execute_step: true });
      const stepManager = new StepManager(paramProvider);

      stepManager.composedSteps([
        stubStepFactory('Step 1'),
        stubStepFactory('Step 2'),
        stubStepFactory('Step 3'),
      ], true);

      expect(await stepManager.run()).toStrictEqual(['Composition of Step 1, Step 2, Step 3']);
    });

    test('Single composed optional step wont run if not confirmed', async function () {
      const paramProvider = stubParamProviderFactory({ execute_step: false });
      const stepManager = new StepManager(paramProvider);

      stepManager.composedSteps([
        stubStepFactory('Step 1'),
        stubStepFactory('Step 2'),
        stubStepFactory('Step 3'),
      ], true);

      expect(await stepManager.run()).toStrictEqual([]);
    });
  });

  describe('Multiple simple steps', function () {
    test('Can add and run multiple required simple and composed steps in order', async function () {
      const paramProvider = stubParamProviderFactory({});
      const stepManager = new StepManager(paramProvider);

      stepManager
        .step(stubStepFactory('Step 1'))
        .composedSteps([
          stubStepFactory('Step 2'),
          stubStepFactory('Step 3'),
          stubStepFactory('Step 4'),
        ])
        .step(stubStepFactory('Step 5'))
        .step(stubStepFactory('Step 6'));

      expect(await stepManager.run()).toStrictEqual(['Step 1', 'Composition of Step 2, Step 3, Step 4', 'Step 5', 'Step 6']);
    });

    test('Can add and run multiple required simple and composed steps in order', async function () {
      const paramProvider = stubParamProviderFactory({});
      const stepManager = new StepManager(paramProvider);

      stepManager
        .step(stubStepFactory('Step 1'))
        .composedSteps([
          stubStepFactory('Step 2'),
          stubStepFactory('Step 3'),
          stubStepFactory('Step 4'),
        ])
        .step(stubStepFactory('Step 5'))
        .step(stubStepFactory('Step 6'));

      expect(await stepManager.run()).toStrictEqual(['Step 1', 'Composition of Step 2, Step 3, Step 4', 'Step 5', 'Step 6']);
    });

    test('Rules for optional execution properly followed for complex sequence of steps', async function () {
      const paramProvider = stubParamProviderFactory({});
      const mockedGet = jest.fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);
      paramProvider.get = mockedGet.bind(paramProvider);
      const stepManager = new StepManager(paramProvider);

      stepManager
        .step(stubStepFactory('Step 1'))
        .composedSteps([
          stubStepFactory('Step 2'),
          stubStepFactory('Step 3'),
          stubStepFactory('Step 4'),
        ])
        .step(stubStepFactory('Step 5'), true)
        .step(stubStepFactory('Step 6'), true)
        .composedSteps([
          stubStepFactory('Step 7'),
          stubStepFactory('Step 8'),
        ])
        .step(stubStepFactory('Step 9'), true)
        .composedSteps([
          stubStepFactory('Step 10'),
          stubStepFactory('Step 11'),
        ], true);

      expect(await stepManager.run()).toStrictEqual([
        'Step 1', // not optional
        'Composition of Step 2, Step 3, Step 4', // not optional
        'Step 5',
        'Step 6',
        'Composition of Step 7, Step 8',
      ]);
    });
  });

  describe('Steps and Param Provider Invocations', function () {
    test('Composable steps should share param state', async function () {
      const callOrder: string[] = [];

      const paramProvider = stubParamProviderFactory({});
      paramProvider.get = jest.fn(async () => callOrder.push('get') && 'some string').bind(paramProvider);
      paramProvider.reset = jest.fn(() => callOrder.push('reset')).bind(paramProvider);
      const stepManager = new StepManager(paramProvider);

      await stepManager.composedSteps([
        stubStepFactory('Step 1', true, [{ name: 'some_param', type: 'text' }]),
        stubStepFactory('Step 2', true, [{ name: 'some_param', type: 'text' }]),
        stubStepFactory('Step 3', true, [{ name: 'some_param', type: 'text' }]),
        stubStepFactory('Step 4', true, [{ name: 'some_param', type: 'text' }]),
      ]).run();

      // Reset isn't called in between
      expect(callOrder).toStrictEqual(['reset', 'get', 'get', 'get', 'get']);
    });

    test('Sequential steps should have param state refreshed in between', async function () {
      const callOrder: string[] = [];

      const paramProvider = stubParamProviderFactory({});
      paramProvider.get = jest.fn(async () => callOrder.push('get') && 'some string').bind(paramProvider);
      paramProvider.reset = jest.fn(() => callOrder.push('reset')).bind(paramProvider);
      const stepManager = new StepManager(paramProvider);

      await stepManager
        .step(stubStepFactory('Step 1', true, [{name: 'some_param', type: 'text'}]))
        .step(stubStepFactory('Step 2', true, [{name: 'some_param', type: 'text'}]))
        .step(stubStepFactory('Step 3', true, [{ name: 'some_param', type: 'text' }]))
        .step(stubStepFactory('Step 4', true, [{ name: 'some_param', type: 'text' }]))
        .run();

      // Reset IS called in between
      expect(callOrder).toStrictEqual(['reset', 'get', 'reset', 'get', 'reset', 'get', 'reset', 'get']);
    });
  });
});

