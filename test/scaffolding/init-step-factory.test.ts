import prompts from 'prompts';
import { Module} from '../../src/scaffolding/module';
import { TemplateParam } from '../../src/scaffolding/template-param';
import { initStepFactory } from '../../src/scaffolding/init-step-factory';
import { resolve } from 'path';
import { getFsPaths, runStep } from '../utils';

describe('init step factory', function () {
  const modules: Module[] = [
    {
      name: 'core',
      shortDescription: 'initial core config files',
      togglable: false,
      updatable: true,
      filesToReplace: ['readme.md', '.gitignore'],
      jsonToAugment: {},
      needsTemplateParams: ['someVar'],
    },
    {
      name: 'sourceFiles',
      shortDescription: 'Source code files',
      togglable: true,
      defaultEnabled: true,
      updatable: true,
      filesToReplace: ['src/index.html', 'src/index.js', 'src/index.ml', 'src/index.php'],
      jsonToAugment: {'config1.json': ['nested']},
      needsTemplateParams: ['someVar', 'someOtherVar'],
      dependsOn: [],
    },
    {
      name: 'config',
      shortDescription: 'Config files',
      togglable: true,
      defaultEnabled: false,
      updatable: true,
      filesToReplace: ['config2.json'],
      jsonToAugment: {'config1.json': ['hello', 'foo', 'authors']},
      needsTemplateParams: ['someVar', 'someOtherVar'],
      dependsOn: [],
    },
  ];

  const templateParams: TemplateParam<unknown>[] = [
    {
      prompt: {
        name: 'someVar',
        message: 'Some Var',
        type: 'text'
      },
      getCurrVal: async () => ''
    },
    {
      name: 'someOtherVar',
      uses: [],
      compute: async (pathProvider) => pathProvider.ext(),
    }
  ]

  const scaffoldDir = resolve(__dirname, '../fixtures/example-scaffold');

  it('works if all modules enabled', async function () {
    const step = initStepFactory(scaffoldDir, modules, templateParams);

    prompts.inject(['Var Value', true, true, true]);

    const {fs} = await runStep(step);

    expect(getFsPaths(fs).sort()).toStrictEqual([
      '/ext/.gitignore',
      '/ext/config1.json',
      '/ext/config2.json',
      '/ext/readme.md',
      '/ext/src/index.html',
      '/ext/src/index.js',
      '/ext/src/index.ml',
      '/ext/src/index.php',
    ])
  });


  it('works if all optional modules disabled', async function () {
    const step = initStepFactory(scaffoldDir, modules, templateParams);

    prompts.inject(['Var Value', true, false, false]);

    const {fs} = await runStep(step);

    expect(getFsPaths(fs).sort()).toStrictEqual([
      '/ext/.gitignore',
      '/ext/readme.md',
    ])
  });

  it('respects module defaults if not in advanced mode', async function () {
    const step = initStepFactory(scaffoldDir, modules, templateParams);

    prompts.inject(['Var Value', false]);

    const {fs} = await runStep(step);

    expect(getFsPaths(fs).sort()).toStrictEqual([
      '/ext/.gitignore',
      '/ext/config1.json',
      '/ext/readme.md',
      '/ext/src/index.html',
      '/ext/src/index.js',
      '/ext/src/index.ml',
      '/ext/src/index.php',
    ])
  });



  it('properly sets cache', async function () {
    const cache: Record<string, boolean> = {};
    const step = initStepFactory(scaffoldDir, modules, templateParams, {
      get: async () => true,
      set: async (module, enabled) => {cache[module] = enabled}
    });

    prompts.inject(['Var Value', false]);

    await runStep(step);

    expect(cache).toStrictEqual({
      'sourceFiles': true,
      'config': false
    })
  });
});
