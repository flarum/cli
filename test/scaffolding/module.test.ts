import { prompt } from 'prompts';
import { create as createStore } from 'mem-fs';
import { paramProviderFactory } from '../../src/provider/param-provider';
import { PathFsProvider } from '../../src/provider/path-provider';
import { Module, ModuleStatusCache, currModulesEnabled, promptModulesEnabled, setModuleValues } from '../../src/scaffolding/module';

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
