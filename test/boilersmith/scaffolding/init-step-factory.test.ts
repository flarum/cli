import { Module } from 'boilersmith/scaffolding/module';
import { TemplateParam } from 'boilersmith/scaffolding/template-param';
import { initStepFactory } from 'boilersmith/scaffolding/init-step-factory';
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
      jsonToAugment: { 'config1.json': ['nested'] },
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
      jsonToAugment: { 'config1.json': ['hello', 'foo', 'authors'] },
      needsTemplateParams: ['someVar', 'someOtherVar'],
      dependsOn: [],
    },
  ];

  const templateParams: TemplateParam[] = [
    {
      prompt: {
        name: 'someVar',
        message: 'Some Var',
        type: 'text',
      },
      getCurrVal: async () => '',
    },
    {
      name: 'someOtherVar',
      uses: [],
      compute: async (paths) => paths.package(),
    },
  ];

  const scaffoldDir = resolve(__dirname, '../fixtures/example-scaffold');

  it('works if all modules enabled', async function () {
    const step = initStepFactory(scaffoldDir, modules, templateParams);

    const { fs } = await runStep(step, {}, { usePrompts: true, paramVals: ['Var Value', true, true, true], initialParams: {} });

    expect(getFsPaths(fs).sort()).toStrictEqual([
      '/ext/.gitignore',
      '/ext/config1.json',
      '/ext/config2.json',
      '/ext/readme.md',
      '/ext/src/index.html',
      '/ext/src/index.js',
      '/ext/src/index.ml',
      '/ext/src/index.php',
    ]);
  });

  it('works if all optional modules disabled', async function () {
    const step = initStepFactory(scaffoldDir, modules, templateParams);

    const { fs } = await runStep(step, {}, { usePrompts: true, paramVals: ['Var Value', true, false, false], initialParams: {} });

    expect(getFsPaths(fs).sort()).toStrictEqual(['/ext/.gitignore', '/ext/readme.md']);
  });

  it('respects module defaults if not in advanced mode', async function () {
    const step = initStepFactory(scaffoldDir, modules, templateParams);

    const { fs } = await runStep(step, {}, { usePrompts: true, paramVals: ['Var Value', false], initialParams: {} });

    expect(getFsPaths(fs).sort()).toStrictEqual([
      '/ext/.gitignore',
      '/ext/config1.json',
      '/ext/readme.md',
      '/ext/src/index.html',
      '/ext/src/index.js',
      '/ext/src/index.ml',
      '/ext/src/index.php',
    ]);
  });

  it('properly sets cache', async function () {
    const cache: Record<string, boolean> = {};
    const step = initStepFactory(
      scaffoldDir,
      modules,
      templateParams,
      () => {
        return { files: [], configKeys: {} };
      },
      {
        get: async () => true,
        set: async (module, enabled) => {
          cache[module.name] = enabled;
        },
      }
    );

    await runStep(step, {}, { usePrompts: true, paramVals: ['Var Value', false], initialParams: {} });

    expect(cache).toStrictEqual({
      sourceFiles: true,
      config: false,
    });
  });
});
