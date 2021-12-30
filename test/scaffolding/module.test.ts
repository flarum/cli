import { prompt } from 'prompts';
import { create as createStore } from 'mem-fs';

import { paramProviderFactory } from '../../src/provider/param-provider';
import { PathFsProvider } from '../../src/provider/path-provider';
import { Module, ModuleStatusCache, currModulesEnabled, promptModulesEnabled, setModuleValues, applyModule } from '../../src/scaffolding/module';
import { resolve } from 'path';
import { getExtFileContents, getFsPaths } from '../utils';
import { create } from 'mem-fs-editor';

describe('Module Utils', function () {
  const _cacheData: Record<string, boolean> = {};

  const cache: ModuleStatusCache = {
    get: async (module) => _cacheData[module],
    set: async (module, val) => {
      _cacheData[module] = val;
    },
  };

  const modules: Module[] = [
    {
      name: 'non-togglable',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: [],
      jsonToAugment: {},
      needsTemplateParams: [],
    },
    {
      name: 'default-on',
      togglable: true,
      defaultEnabled: true,
      dependsOn: [],
      updatable: true,
      shortDescription: '',
      filesToReplace: [],
      jsonToAugment: {},
      needsTemplateParams: [],
    },
    {
      name: 'default-off',
      togglable: true,
      defaultEnabled: false,
      dependsOn: [],
      updatable: true,
      shortDescription: '',
      filesToReplace: [],
      jsonToAugment: {},
      needsTemplateParams: [],
    },
  ];

  describe('promptModuleValues', function () {
    it('works in recommended mode', async function () {
      prompt.inject([false]);

      expect(await promptModulesEnabled(modules, paramProviderFactory({}))).toStrictEqual({
        'non-togglable': true,
        'default-on': true,
        'default-off': false,
      });
    });

    it('works in advanced mode', async function () {
      prompt.inject([true, false, true]);

      expect(await promptModulesEnabled(modules, paramProviderFactory({}))).toStrictEqual({
        'non-togglable': true,
        'default-on': false,
        'default-off': true,
      });
    });
  });

  describe('currModuleValues', function () {
    it('works with cache when not in cache', async function () {
      expect(await currModulesEnabled(modules, createStore(), new PathFsProvider({ ext: '' }), cache)).toStrictEqual({
        'non-togglable': true,
        'default-on': true,
        'default-off': false,
      });
    });

    it('works with cache when in cache', async function () {
      _cacheData['non-togglable'] = false;
      _cacheData['default-on'] = true;
      _cacheData['default-off'] = true;

      expect(await currModulesEnabled(modules, createStore(), new PathFsProvider({ ext: '' }), cache)).toStrictEqual({
        'non-togglable': true,
        'default-on': true,
        'default-off': true,
      });
    });

    it('works without cache', async function () {
      _cacheData['non-togglable'] = false;
      _cacheData['default-on'] = true;
      _cacheData['default-off'] = true;

      expect(await currModulesEnabled(modules, createStore(), new PathFsProvider({ ext: '' }))).toStrictEqual({
        'non-togglable': true,
        'default-on': true,
        'default-off': false,
      });
    });
  });

  describe('setModuleValues', function () {
    it('works', async function () {
      delete _cacheData['non-togglable'];
      delete _cacheData['default-on'];
      delete _cacheData['default-off'];

      await setModuleValues(modules, { 'default-on': false, 'default-off': false }, createStore(), new PathFsProvider({ ext: '' }), cache);

      expect(_cacheData).toStrictEqual({
        'default-on': false,
        'default-off': false,
      });
    });
  });
});

describe('applyModule', function () {
  const scaffoldDir = resolve(__dirname, '../fixtures/example-scaffold');

  const justFilesModule: Module = {
    name: 'just-files',
    togglable: false,
    updatable: true,
    shortDescription: '',
    filesToReplace: ['.gitignore', 'readme.md'],
    jsonToAugment: {},
    needsTemplateParams: [],
  };

  it('errors if module marked as disabled', async function () {
    expect(
      async () => await applyModule(justFilesModule, { 'just-files': false }, {}, scaffoldDir, createStore(), new PathFsProvider({ ext: '/ext' }))
    ).rejects.toThrow(new Error('Could not apply module "just-files", because it is not enabled in the provided module statuses.'));
  });

  it('errors if module not present in modulesEnabled', async function () {
    expect(
      async () => await applyModule(justFilesModule, { somethingElse: true }, {}, scaffoldDir, createStore(), new PathFsProvider({ ext: '/ext' }))
      ).rejects.toThrow(new Error('Could not apply module "just-files", because it is not enabled in the provided module statuses.'));
  });

  it('errors if missing template params', async function () {
    const module = {...justFilesModule, needsTemplateParams: ['missing']};
  
    expect(
      async () => await applyModule(module, { 'just-files': true }, {somethingElse: '42'}, scaffoldDir, createStore(), new PathFsProvider({ ext: '/ext' }))
      ).rejects.toThrow(new Error('Could not apply module "just-files", because the following params are missing: "missing".'));
  });

  it('copies over files', async function () {
    const fs = await applyModule(justFilesModule, { 'just-files': true }, {}, scaffoldDir, createStore(), new PathFsProvider({ ext: '/ext' }));

    expect(getFsPaths(fs)).toStrictEqual(justFilesModule.filesToReplace.map((p) => `/ext/${p}`));
    expect(getExtFileContents(fs, '.gitignore')).toStrictEqual('node_modules');
    expect(getExtFileContents(fs, 'readme.md')).toStrictEqual('# Sample Scaffolding');
  });

  it('copies over JSON data', async function () {
    const module: Module = {
      name: 'just-json',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: [],
      jsonToAugment: { 'config1.json': ['nested.config.string', 'hello'] },
      needsTemplateParams: ['someVar', 'someOtherVar'],
    };

    const fs = await applyModule(
      module,
      { 'just-json': true },
      { someVar: 'val1', someOtherVar: 'val2' },
      scaffoldDir,
      createStore(),
      new PathFsProvider({ ext: '/ext' })
    );

    expect(getFsPaths(fs)).toStrictEqual(['/ext/config1.json']);
    expect(JSON.parse(getExtFileContents(fs, 'config1.json'))).toStrictEqual({ hello: 'val1', nested: { config: { string: 'a' } } });
  });

  it('populates variables correctly', async function () {
    const module: Module = {
      name: 'with-var',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: ['src/index.ml'],
      jsonToAugment: { 'config1.json': ['hello', 'foo'] },
      needsTemplateParams: ['someVar', 'someOtherVar'],
    };

    const fs = await applyModule(
      module,
      { 'with-var': true },
      { someVar: 5, someOtherVar: false },
      scaffoldDir,
      createStore(),
      new PathFsProvider({ ext: '/ext' })
    );

    expect(getFsPaths(fs)).toStrictEqual(['/ext/config1.json', '/ext/src/index.ml']);
    expect(getExtFileContents(fs, 'src/index.ml')).toStrictEqual('5');
    expect(JSON.parse(getExtFileContents(fs, 'config1.json'))).toStrictEqual({ foo: 'false', hello: '5' });
  });

  it('doesnt affect other JSON keys', async function () {
    const module: Module = {
      name: 'just-json',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: [],
      jsonToAugment: { 'config1.json': ['nested.config.boolean', 'hello'] },
      needsTemplateParams: ['someVar', 'someOtherVar'],
    };

    const fs = createStore();

    create(fs).writeJSON('/ext/config1.json', {
      hello: 'should be overwritten',
      other: 'keep this',
      nested: {
        config: {
          string: 'hello',
          boolean: [1, 2, 3],
        },
        somethingElse: 7,
      },
    });

    await applyModule(module, { 'just-json': true }, { someVar: 'val1', someOtherVar: 'val2' }, scaffoldDir, fs, new PathFsProvider({ ext: '/ext' }));

    expect(getFsPaths(fs)).toStrictEqual(['/ext/config1.json']);
    expect(JSON.parse(getExtFileContents(fs, 'config1.json'))).toStrictEqual({
      hello: 'val1',
      other: 'keep this',
      nested: { config: { string: 'hello', boolean: true }, somethingElse: 7 },
    });
  });
});
