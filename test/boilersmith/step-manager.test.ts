/* eslint-disable max-nested-callbacks */
import { prompt } from 'prompts';
import { PromptsIO } from 'boilersmith/io';
import { AtomicStepManager, StepManager } from 'boilersmith/step-manager';
import { stubStepFactory } from './utils';
import { NodePaths } from 'boilersmith/paths';

describe('Step Manager Validation', function () {
  describe('dependencies on nonexistent steps will cause errors', function () {
    test('Holds without steps before', function () {
      expect(() => {
        new StepManager().step(stubStepFactory('Generate Controller'), { optional: false }, [
          {
            sourceStep: 'model',
            exposedName: 'modelClass',
          },
        ]);
      }).toThrow('Step of type "Generate Controller" depends on nonexistent named steps "model"');
    });

    test('Holds with steps before', function () {
      expect(() => {
        new StepManager().step(stubStepFactory('Some irrelevant step')).step(stubStepFactory('Generate Controller'), { optional: false }, [
          {
            sourceStep: 'model',
            exposedName: 'modelClass',
          },
        ]);
      }).toThrow('Step of type "Generate Controller" depends on nonexistent named steps "model"');
    });

    test('Holds for named steps', function () {
      expect(() => {
        new StepManager().namedStep('someName', stubStepFactory('Generate Controller'), { optional: false }, [
          {
            sourceStep: 'model',
            exposedName: 'modelClass',
          },
        ]);
      }).toThrow('Step of type "Generate Controller" depends on nonexistent named steps "model"');
    });

    test('Holds with atomic group', function () {
      expect(() => {
        new StepManager().atomicGroup(stepManager => {
          stepManager.step(stubStepFactory('Generate Controller'), { optional: false }, [
            {
              sourceStep: 'model',
              exposedName: 'modelClass',
            },
          ]);
        });
      }).toThrow('Step of type "Generate Controller" depends on nonexistent named steps "model"');
    });
  });

  describe('Dependencies on non-existent exposed params from existing steps will error when being added', function () {
    test('Holds when dependency doesnt have any params', function () {
      expect(() => {
        new StepManager().namedStep('model', stubStepFactory('Generate Model')).step(stubStepFactory('Generate Controller'), { optional: false }, [
          {
            sourceStep: 'model',
            exposedName: 'modelClass',
          },
        ]);
      }).toThrow('Step of type "Generate Controller" depends on nonexistent exposed params "modelClass" from named steps "model"');
    });

    test('Holds when dependency has params but none with required name', function () {
      expect(() => {
        new StepManager()
          .namedStep('model', stubStepFactory('Generate Model', true, [], { somethingElse: 'Something' }))
          .step(stubStepFactory('Generate Controller'), { optional: false }, [
            {
              sourceStep: 'model',
              exposedName: 'modelClass',
            },
          ]);
      }).toThrow('Step of type "Generate Controller" depends on nonexistent exposed params "modelClass" from named steps "model"');
    });

    test('Holds with atomic group', function () {
      expect(() => {
        new StepManager().namedStep('model', stubStepFactory('Generate Model')).atomicGroup(stepManager => {
          stepManager.step(stubStepFactory('Generate Controller'), { optional: false }, [
            {
              sourceStep: 'model',
              exposedName: 'modelClass',
            },
          ]);
        });
      }).toThrow('Step of type "Generate Controller" depends on nonexistent exposed params "modelClass" from named steps "model"');
    });

    test('`__succeeded` magic param is allowed.', function () {
      expect(() => {
        new StepManager().namedStep('model', stubStepFactory('Generate Model')).step(stubStepFactory('Generate Controller'), { optional: false }, [
          {
            sourceStep: 'model',
            exposedName: '__succeeded',
          },
        ]);
      }).not.toThrow();
    });
  });

  describe('Dependencies of mapped steps must also be mapped over an equal of greater set of paths', function () {
    test('holds for named steps mapped over paths', function () {
      expect(() => {
        new StepManager()
          .namedStep('someName', stubStepFactory('Generate Controller', true, [], { exposedParam: 'val' }), { optional: false }, [], {}, [
            'packages/a',
            'packages/b',
          ])
          .namedStep(
            'nonOverlapping',
            stubStepFactory('Dependent'),
            { optional: false },
            [
              {
                sourceStep: 'someName',
                exposedName: 'exposedParam',
              },
            ],
            {},
            ['packages/b', 'packages/c', 'packages/d'],
          );
      }).toThrow(
        'Step of type "Dependent" (A) depends on named step: "someName" (B), but is mapped across some paths that (B) is not: "packages/c, packages/d"',
      );
    });

    test('holds for unnamed steps mapped over paths', function () {
      expect(() => {
        new StepManager()
          .namedStep('someName', stubStepFactory('Generate Controller', true, [], { exposedParam: 'val' }), { optional: false }, [], {}, [
            'packages/a',
            'packages/b',
          ])
          .step(
            stubStepFactory('Dependent'),
            { optional: false },
            [
              {
                sourceStep: 'someName',
                exposedName: 'exposedParam',
              },
            ],
            {},
            ['packages/b', 'packages/c', 'packages/d'],
          );
      }).toThrow(
        'Step of type "Dependent" (A) depends on named step: "someName" (B), but is mapped across some paths that (B) is not: "packages/c, packages/d"',
      );
    });
  });

  test('Non-mapped step may not depend on mapped step', function () {
    expect(() => {
      new StepManager()
        .namedStep('mapped', stubStepFactory('Generate Controller', true, [], { exposedParam: 'val' }), { optional: false }, [], {}, [
          'packages/a',
          'packages/b',
        ])
        .step(stubStepFactory('Dependent'), { optional: false }, [
          {
            sourceStep: 'mapped',
            exposedName: 'exposedParam',
          },
        ]);
    }).toThrow('Non path-mapped step of type "Dependent" may not depend on path-mapped step "mapped".');
  });

  describe('Named steps must be unique', function () {
    test('Holds with simple steps', function () {
      expect(() => {
        new StepManager().namedStep('model', stubStepFactory('Generate Model')).namedStep('model', stubStepFactory('Generate Serializer'));
      }).toThrow('Named steps must have unique names. A step with name "model" already exists.');
    });

    test('Holds with atomic group', function () {
      expect(() => {
        new StepManager().namedStep('model', stubStepFactory('Generate Model')).atomicGroup(stepManager => {
          stepManager.namedStep('model', stubStepFactory('Generate Serializer'));
        });
      }).toThrow('Named steps must have unique names. A step with name "model" already exists.');
    });
  });

  test('Errors when trying to put non-composable step in atomic group', async function () {
    expect(() => {
      new StepManager().atomicGroup(stepManager => {
        stepManager.step(stubStepFactory('Step 1')).step(stubStepFactory('Step 2', false)).step(stubStepFactory('Step 3'));
      });
    }).toThrow('Step of type "Step 2" is not composable, and cannot be added to an atomic group.');
  });

  test("Atomic groups can't be nested.", async function () {
    expect(() => {
      new StepManager().atomicGroup(stepManager => {
        stepManager
          .step(stubStepFactory('Step 1'))
          .atomicGroup(stepManagerInner => {
            stepManagerInner.step(stubStepFactory('Step 2')).step(stubStepFactory('Step 3'));
          })
          .step(stubStepFactory('Step 4'));
      });
    }).toThrow("Atomic groups can't be nested.");
  });
});

describe('Step Manager Execution', function () {
  let io = new PromptsIO();
  const paths = new NodePaths({ package: '/ext' });

  const ioNewFunc = jest.fn(function (this: PromptsIO, cache = {}, message = []) {
    const instance = new PromptsIO(cache, message);
    instance.newInstance = ioNewFunc;

    return instance;
  });

  const pathsNewFunc = jest.fn(function (this: NodePaths, packagePath: string) {
    const instance = new NodePaths({ ...this.paths, monorepo: this.paths.package, package: packagePath });

    instance.onMonorepoSub = pathsNewFunc;

    return instance;
  });

  io.newInstance = ioNewFunc;
  paths.onMonorepoSub = pathsNewFunc;

  let commitMethod: jest.SpyInstance<any, unknown[]>;

  beforeEach(() => {
    io = io.newInstance({}, []);
    ioNewFunc.mockClear();
    pathsNewFunc.mockClear();
    commitMethod = jest.spyOn(StepManager.prototype as any, 'commit');
  });

  afterEach(() => {
    commitMethod.mockReset();
    commitMethod.mockRestore();
  });

  test('Can run a complex but valid sequence of steps, params properly passed to dependencies', async function () {
    const results = await new StepManager()
      .step(stubStepFactory('Standalone'))
      .step(stubStepFactory('Standalone'))
      .namedStep('model', stubStepFactory('Generate Model', true, [], { modelClass: 'Something' }))
      .step(stubStepFactory('Generate Controller'), { optional: false }, [
        {
          sourceStep: 'model',
          exposedName: 'modelClass',
        },
      ])
      .step(stubStepFactory('Generate Serializer'), { optional: false }, [
        {
          sourceStep: 'model',
          exposedName: 'modelClass',
          consumedName: 'targetModelClass',
        },
      ])
      .atomicGroup(stepManager => {
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
              consumedName: 'isntUsedHereButWhyNot',
            },
          ]);
      })
      .run(paths, io, {});

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
    expect(JSON.stringify(ioNewFunc.mock.calls)).toStrictEqual(
      JSON.stringify([
        [{}, []],
        [{}, []],
        [{}, []],
        [{ modelClass: 'Something' }, []],
        [{ targetModelClass: 'Something' }, []],
        [{}, []],
        [{ listenerClass: 'Something Else', isntUsedHereButWhyNot: 'Something' }, []],
      ]),
    );

    // No path-mapped calls here.
    expect(JSON.stringify(pathsNewFunc.mock.calls)).toStrictEqual('[]');

    expect(commitMethod.mock.calls.length).toBe(6);
  });

  test('Steps can consume `__succeeded` magic param from previous steps', async function () {
    prompt.inject([true]);
    const results = await new StepManager()
      .namedStep('step with no exposed params', stubStepFactory('Standalone'))
      .step(stubStepFactory('Standalone'), {}, [
        {
          sourceStep: 'step with no exposed params',
          exposedName: '__succeeded',
        },
      ])
      .step(stubStepFactory('Standalone Optional'), { optional: true, default: true }, [
        {
          sourceStep: 'step with no exposed params',
          exposedName: '__succeeded',
          dontRunIfFalsy: true,
        },
      ])
      .run(paths, io, {});

    expect(results).toStrictEqual(['Standalone', 'Standalone', 'Standalone Optional']);

    // Tests that params are shared properly.
    expect(JSON.stringify(ioNewFunc.mock.calls)).toStrictEqual(
      JSON.stringify([
        [{}, []],
        [{ __succeeded: true }, []],
        [{ context: 'Confirm Step' }, []], // Prompt for confirmation of optional step
        [{ __succeeded: true }, []],
      ]),
    );

    expect(JSON.stringify(pathsNewFunc.mock.calls)).toStrictEqual('[]');
  });

  test('Optional steps wont run if not confirmed', async function () {
    prompt.inject([true, false, false, true]);

    const results = await new StepManager()
      .step(stubStepFactory('Optional runs'), { optional: true })
      .step(stubStepFactory('Optional not runs'), { optional: true })
      .step(stubStepFactory('Not Optional'))
      .atomicGroup(stepManager => {
        stepManager
          .step(stubStepFactory('Atomic optional not runs'), { optional: true })
          .step(stubStepFactory('Atomic not optional'))
          .step(stubStepFactory('Atomic optional runs'), { optional: true });
      })
      .run(paths, io, {});

    expect(results).toStrictEqual(['Optional runs', 'Not Optional', 'Atomic not optional', 'Atomic optional runs']);
  });

  describe("If a step doesnt run, its dependencies won't be run.", function () {
    test('Shallow dependencies', async function () {
      prompt.inject([true, false]);

      const results = await new StepManager()
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
        .run(paths, io, {});

      expect(results).toStrictEqual(['Generate Model', 'Relies on dep1']);
    });

    test('Chained and Atomic Groups', async function () {
      prompt.inject([true, false]);

      const results = await new StepManager()
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
        .atomicGroup(stepManager => {
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
        .run(paths, io, {});

      expect(results).toStrictEqual(['Generate Model', 'Relies on dep1', 'Relies on dep1b']);
    });
  });

  test('If a dependency marked as "dontRunIfFalsy" is falsy, dont run.', async function () {
    const results = await new StepManager()
      .namedStep('dep1', stubStepFactory('Generate Model', true, [], { something: false }))
      .namedStep('dep2', stubStepFactory('Generate Serializer', true, [], { 'something else': true }))
      .step(stubStepFactory('Relies on dep1, shouldnt run'), { optional: false }, [
        {
          sourceStep: 'dep1',
          exposedName: 'something',
          dontRunIfFalsy: true,
        },
      ])
      .step(stubStepFactory('Relies on dep1, should run'), { optional: false }, [
        {
          sourceStep: 'dep1',
          exposedName: 'something',
          dontRunIfFalsy: false,
        },
      ])
      .step(stubStepFactory('Relies on dep2, should run'), { optional: false }, [
        {
          sourceStep: 'dep2',
          exposedName: 'something else',
          dontRunIfFalsy: false,
        },
      ])
      .step(stubStepFactory('Relies on dep2, also should run'), { optional: false }, [
        {
          sourceStep: 'dep2',
          exposedName: 'something else',
          dontRunIfFalsy: false,
        },
      ])
      .run(paths, io, {});

    expect(results).toStrictEqual([
      'Generate Model',
      'Generate Serializer',
      'Relies on dep1, should run',
      'Relies on dep2, should run',
      'Relies on dep2, also should run',
    ]);
  });

  test('Path-mapped steps can pull params from both non-mapped and (larger) mapped.', async function () {
    const results = await new StepManager()
      .namedStep('non-mapped', stubStepFactory('Non Mapped Base', true, [], { nonMappedParam: 'nonMappedVal' }), { optional: false })
      .namedStep(
        'mappedLarge',
        stubStepFactory('Mapped With Many', true, [], { mappedParam: 'mappedVal' }),
        { optional: false },
        [
          {
            sourceStep: 'non-mapped',
            exposedName: 'nonMappedParam',
          },
        ],
        {},
        ['packages/a', 'ext/b', 'plugins/c'],
      )
      .atomicGroup(function (stepManager) {
        return stepManager
          .namedStep('non-mapped-atomic', stubStepFactory('Non Mapped Atomic', true, [], { nonMappedParam2: 'nonMappedVal2' }), { optional: false })
          .step(
            stubStepFactory('Mapped Final'),
            { optional: false },
            [
              {
                sourceStep: 'mappedLarge',
                exposedName: 'mappedParam',
              },
              {
                sourceStep: 'non-mapped-atomic',
                exposedName: 'nonMappedParam2',
              },
            ],
            {},
            ['packages/a', 'ext/b'],
          );
      })
      .run(paths, io, {});

    expect(results).toStrictEqual([
      'Non Mapped Base',
      'Mapped With Many (packages/a)',
      'Mapped With Many (ext/b)',
      'Mapped With Many (plugins/c)',
      'Non Mapped Atomic',
      'Mapped Final (packages/a)',
      'Mapped Final (ext/b)',
    ]);

    // Tests that params are shared properly.
    expect(JSON.stringify(ioNewFunc.mock.calls)).toStrictEqual(
      JSON.stringify([
        [{}, []],
        [
          {
            nonMappedParam: 'nonMappedVal',
          },
          [],
        ],
        [{ nonMappedParam: 'nonMappedVal' }, []],
        [{ nonMappedParam: 'nonMappedVal' }, []],
        [{}, []],
        [{ mappedParam: 'mappedVal', nonMappedParam2: 'nonMappedVal2' }, []],
        [{ mappedParam: 'mappedVal', nonMappedParam2: 'nonMappedVal2' }, []],
      ]),
    );

    // No path-mapped calls here.
    expect(JSON.stringify(pathsNewFunc.mock.calls)).toStrictEqual(JSON.stringify([['packages/a'], ['ext/b'], ['plugins/c'], ['packages/a'], ['ext/b']]));

    expect(commitMethod.mock.calls.length).toBe(5);
  });

  test('some path mapped steps, but not others, can run', async function () {
    prompt.inject([true, false, true]);

    const results = await new StepManager()
      .namedStep('mapped', stubStepFactory('Optional'), { optional: true }, [], {}, ['packages/a', 'exts/b', 'plugins/c'])
      .step(
        stubStepFactory('Followup'),
        { optional: false },
        [
          {
            sourceStep: 'mapped',
            exposedName: '__succeeded',
          },
        ],
        {},
        ['packages/a', 'exts/b', 'plugins/c'],
      )
      .run(paths, io, {});

    expect(results).toStrictEqual(['Optional (packages/a)', 'Optional (plugins/c)', 'Followup (packages/a)', 'Followup (plugins/c)']);

    expect(commitMethod.mock.calls.length).toBe(4);
  });

  test('can dry run on StepManager', async function () {
    const results = await new StepManager().step(stubStepFactory('Step 1')).step(stubStepFactory('Step 2')).run(paths, io, {}, true);

    expect(results).toStrictEqual(['Step 1', 'Step 2']);

    expect(commitMethod.mock.calls.length).toBe(0);
  });

  test('cannot dry run on StepManager with composable steps', async function () {
    expect(async () => new StepManager().step(stubStepFactory('Step 1', false)).step(stubStepFactory('Step 2')).run(paths, io, {}, true)).rejects.toThrow(
      'Cannot dry run, as this step manager has non-composable steps.',
    );
  });

  test('can dry run on AtomicStepManager', async function () {
    const results = await new AtomicStepManager().step(stubStepFactory('Step 1')).step(stubStepFactory('Step 2')).run(paths, io, {}, true);

    expect(results).toStrictEqual(['Step 1', 'Step 2']);

    expect(commitMethod.mock.calls.length).toBe(0);
  });
});
