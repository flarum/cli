/* eslint-disable max-nested-callbacks */
import { prompt } from 'prompts';
import { paramProviderFactory as defaultPPFac } from '../../src/provider/param-provider';
import { StepManager } from '../../src/steps/step-manager';
import { stubPathProviderFactory, stubPhpProviderFactory, stubStepFactory } from '../stubs';

describe('Step Manager Validation', function () {
  describe('dependencies on nonexistent steps will cause errors', function () {
    test('Holds without steps before', function () {
      expect(() => {
        (new StepManager())
          .step(stubStepFactory('Generate Controller'), { optional: false }, [{
            sourceStep: 'model',
            exposedName: 'modelClass',
          }]);
      }).toThrow('Step of type "Generate Controller" depends on nonexistent named steps "model"');
    });

    test('Holds with steps before', function () {
      expect(() => {
        (new StepManager())
          .step(stubStepFactory('Some irrelevant step'))
          .step(stubStepFactory('Generate Controller'), { optional: false }, [{
            sourceStep: 'model',
            exposedName: 'modelClass',
          }]);
      }).toThrow('Step of type "Generate Controller" depends on nonexistent named steps "model"');
    });

    test('Holds for named steps', function () {
      expect(() => {
        (new StepManager())
          .namedStep('someName', stubStepFactory('Generate Controller'), { optional: false }, [{
            sourceStep: 'model',
            exposedName: 'modelClass',
          }]);
      }).toThrow('Step of type "Generate Controller" depends on nonexistent named steps "model"');
    });

    test('Holds with atomic group', function () {
      expect(() => {
        (new StepManager())
          .atomicGroup((stepManager: StepManager) => {
            stepManager
              .step(stubStepFactory('Generate Controller'), { optional: false }, [{
                sourceStep: 'model',
                exposedName: 'modelClass',
              }]);
          });
      }).toThrow('Step of type "Generate Controller" depends on nonexistent named steps "model"');
    });
  });

  describe('Dependencies on non-existent exposed params from existing steps will error when being added', function () {
    test('Holds when dependency doesnt have any params', function () {
      expect(() => {
        (new StepManager())
          .namedStep('model', stubStepFactory('Generate Model'))
          .step(stubStepFactory('Generate Controller'), { optional: false }, [{
            sourceStep: 'model',
            exposedName: 'modelClass',
          }]);
      }).toThrow('Step of type "Generate Controller" depends on nonexistent exposed params "modelClass" from named steps "model"');
    });

    test('Holds when dependency has params but none with required name', function () {
      expect(() => {
        (new StepManager())
          .namedStep('model', stubStepFactory('Generate Model', true, [], { somethingElse: 'Something' }))
          .step(stubStepFactory('Generate Controller'), { optional: false }, [{
            sourceStep: 'model',
            exposedName: 'modelClass',
          }]);
      }).toThrow('Step of type "Generate Controller" depends on nonexistent exposed params "modelClass" from named steps "model"');
    });

    test('Holds with atomic group', function () {
      expect(() => {
        (new StepManager())
          .namedStep('model', stubStepFactory('Generate Model'))
          .atomicGroup((stepManager: StepManager) => {
            stepManager
              .step(stubStepFactory('Generate Controller'), { optional: false }, [{
                sourceStep: 'model',
                exposedName: 'modelClass',
              }]);
          });
      }).toThrow('Step of type "Generate Controller" depends on nonexistent exposed params "modelClass" from named steps "model"');
    });
  });

  describe('Named steps must be unique', function () {
    test('Holds with simple steps', function () {
      expect(() => {
        (new StepManager())
          .namedStep('model', stubStepFactory('Generate Model'))
          .namedStep('model', stubStepFactory('Generate Serializer'));
      }).toThrow('Named steps must have unique names. A step with name "model" already exists.');
    });

    test('Holds with atomic group', function () {
      expect(() => {
        (new StepManager())
          .namedStep('model', stubStepFactory('Generate Model'))
          .atomicGroup((stepManager: StepManager) => {
            stepManager
              .namedStep('model', stubStepFactory('Generate Serializer'));
          });
      }).toThrow('Named steps must have unique names. A step with name "model" already exists.');
    });
  });

  test('Errors when trying to put non-composable step in atomic group', async function () {
    expect(() => {
      (new StepManager())
        .atomicGroup((stepManager: StepManager) => {
          stepManager
            .step(stubStepFactory('Step 1'))
            .step(stubStepFactory('Step 2', false))
            .step(stubStepFactory('Step 3'));
        });
    }).toThrow('Step of type "Step 2" is not composable, and cannot be added to an atomic group.');
  });

  test("Atomic groups can't be nested.", async function () {
    expect(() => {
      (new StepManager())
        .atomicGroup((stepManager: StepManager) => {
          stepManager
            .step(stubStepFactory('Step 1'))
            .atomicGroup((stepManagerInner: StepManager) => {
              stepManagerInner
                .step(stubStepFactory('Step 2'))
                .step(stubStepFactory('Step 3'));
            })
            .step(stubStepFactory('Step 4'));
        });
    }).toThrow("Atomic groups can't be nested.");
  });
});

describe('Step Manager Execution', function () {
  const paramProviderFactory = jest.fn(defaultPPFac);

  test('Can run a complex but valid sequence of steps, params properly passed to dependencies', async function () {
    const commitMethod = jest.spyOn(StepManager.prototype as any, 'commit');

    const results = await (new StepManager())
      .step(stubStepFactory('Standalone'))
      .step(stubStepFactory('Standalone'))
      .namedStep('model', stubStepFactory('Generate Model', true, [], { modelClass: 'Something' }))
      .step(stubStepFactory('Generate Controller'), { optional: false }, [{
        sourceStep: 'model',
        exposedName: 'modelClass',
      }])
      .step(stubStepFactory('Generate Serializer'), { optional: false }, [{
        sourceStep: 'model',
        exposedName: 'modelClass',
        consumedName: 'targetModelClass',
      }])
      .atomicGroup((stepManager: StepManager) => {
        stepManager
          .namedStep('listener', stubStepFactory('Generate Listener', true, [], { listenerClass: 'Something Else' }))
          .step(stubStepFactory('Listener Extender'), { optional: false }, [
            {
              sourceStep: 'listener',
              exposedName: 'listenerClass',
            },
            {
              sourceStep: 'model',
              exposedName: 'modelClass',
              consumedName: 'isnt_used_here_but_why_not',
            },
          ]);
      })
      .run(stubPathProviderFactory(), paramProviderFactory, stubPhpProviderFactory());

    // Tests that all steps run, and that they do so in order.
    expect(results).toStrictEqual([
      'Standalone',
      'Standalone',
      'Generate Model',
      'Generate Controller',
      'Generate Serializer',
      'Generate Listener',
      'Listener Extender',
    ]);

    // Tests that params are shared properly.
    expect(JSON.stringify(paramProviderFactory.mock.calls)).toStrictEqual(JSON.stringify([
      [{}],
      [{}],
      [{}],
      [{ modelClass: 'Something' }],
      [{ targetModelClass: 'Something' }],
      [{}],
      [{ listenerClass: 'Something Else', isnt_used_here_but_why_not: 'Something' }],
    ]));

    expect(commitMethod.mock.calls.length).toBe(6);
  });

  test('Optional steps wont run if not confirmed', async function () {
    prompt.inject([true, false, false, true]);

    const results = await (new StepManager())
      .step(stubStepFactory('Optional runs'), { optional: true })
      .step(stubStepFactory('Optional not runs'), { optional: true })
      .step(stubStepFactory('Not Optional'))
      .atomicGroup((stepManager: StepManager) => {
        stepManager
          .step(stubStepFactory('Atomic optional not runs'), { optional: true })
          .step(stubStepFactory('Atomic not optional'))
          .step(stubStepFactory('Atomic optional runs'), { optional: true });
      })
      .run(stubPathProviderFactory(), paramProviderFactory, stubPhpProviderFactory());

    expect(results).toStrictEqual([
      'Optional runs',
      'Not Optional',
      'Atomic not optional',
      'Atomic optional runs',
    ]);
  });

  describe("If a step doesnt run, its dependencies won't be run.", function () {
    test('Shallow dependencies', async function () {
      prompt.inject([true, false]);

      const results = await (new StepManager())
        .namedStep('dep1', stubStepFactory('Generate Model', true, [], { something: 'X' }), { optional: true })
        .namedStep('dep2', stubStepFactory('Generate Serializer', true, [], { 'something else': 'Y' }), { optional: true })
        .step(stubStepFactory('Relies on dep1'), { optional: false }, [
          {
            sourceStep: 'dep1',
            exposedName: 'something',
          },
        ])
        .step(stubStepFactory('Relies on dep2'), { optional: false }, [
          {
            sourceStep: 'dep2',
            exposedName: 'something else',
          },
        ])
        .run(stubPathProviderFactory(), paramProviderFactory, stubPhpProviderFactory());

      expect(results).toStrictEqual([
        'Generate Model',
        'Relies on dep1',
      ]);
    });

    test('Chained and Atomic Groups', async function () {
      prompt.inject([true, false]);

      const results = await (new StepManager())
        .namedStep('dep1', stubStepFactory('Generate Model', true, [], { something: 'X' }), { optional: true })
        .namedStep('dep2', stubStepFactory('Generate Serializer', true, [], { 'something else': 'Y' }), { optional: true })
        .namedStep('dep1b', stubStepFactory('Relies on dep1', true, [], { foo: 'bar' }), { optional: false }, [
          {
            sourceStep: 'dep1',
            exposedName: 'something',
          },
        ])
        .namedStep('dep2b', stubStepFactory('Relies on dep2', true, [], { hello: 'world' }), { optional: false }, [
          {
            sourceStep: 'dep2',
            exposedName: 'something else',
          },
        ])
        .atomicGroup((stepManager: StepManager) => {
          stepManager
            .step(stubStepFactory('Relies on dep1b'), { optional: false }, [
              {
                sourceStep: 'dep1b',
                exposedName: 'foo',
              },
            ])
            .step(stubStepFactory('Relies on dep2b'), { optional: false }, [
              {
                sourceStep: 'dep2b',
                exposedName: 'hello',
              },
            ]);
        })
        .run(stubPathProviderFactory(), paramProviderFactory, stubPhpProviderFactory());

      expect(results).toStrictEqual([
        'Generate Model',
        'Relies on dep1',
        'Relies on dep1b',
      ]);
    });
  });
});
