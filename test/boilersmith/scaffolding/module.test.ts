import { prompt } from 'prompts';
import { create as createStore } from 'mem-fs';

import { PromptsIO } from 'boilersmith/io';
import { NodePaths } from 'boilersmith/paths';
import { Module, ModuleStatusCache, currModulesEnabled, promptModulesEnabled, setModuleValue, applyModule } from 'boilersmith/scaffolding/module';
import { resolve } from 'node:path';
import { getExtFileContents, getFsPaths } from '../utils';
import { create } from 'mem-fs-editor';

describe('Module Utils', function () {
  const _cacheData: Record<string, boolean> = {};

  const cache: ModuleStatusCache<string> = {
    get: async (module) => _cacheData[module.name],
    set: async (module, val) => {
      _cacheData[module.name] = val;
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
      // eslint-disable-next-line unicorn/no-useless-undefined
      inferEnabled: async () => undefined,
    },
    {
      name: 'default-off-infer-on',
      togglable: true,
      defaultEnabled: false,
      dependsOn: [],
      updatable: true,
      shortDescription: '',
      filesToReplace: [],
      jsonToAugment: {},
      needsTemplateParams: [],
      inferEnabled: async () => true,
    },
  ];

  describe('promptModuleValues', function () {
    it('works in recommended mode', async function () {
      prompt.inject([false]);

      expect(await promptModulesEnabled(modules, new PromptsIO())).toStrictEqual({
        'non-togglable': true,
        'default-on': true,
        'default-off': false,
        'default-off-infer-on': false,
      });
    });

    it('works in advanced mode', async function () {
      prompt.inject([true, false, true, false]);

      expect(await promptModulesEnabled(modules, new PromptsIO())).toStrictEqual({
        'non-togglable': true,
        'default-on': false,
        'default-off': true,
        'default-off-infer-on': false,
      });
    });
  });

  describe('currModuleValues', function () {
    it('works with cache when not in cache', async function () {
      expect(await currModulesEnabled(modules, createStore(), new NodePaths({ package: '' }), cache)).toStrictEqual({
        'non-togglable': true,
        'default-on': true,
        'default-off': false,
        'default-off-infer-on': true,
      });
    });

    it('works with cache when in cache', async function () {
      _cacheData['non-togglable'] = false;
      _cacheData['default-on'] = true;
      _cacheData['default-off'] = true;
      _cacheData['default-off-infer-on'] = false;

      expect(await currModulesEnabled(modules, createStore(), new NodePaths({ package: '' }), cache)).toStrictEqual({
        'non-togglable': true,
        'default-on': true,
        'default-off': true,
        'default-off-infer-on': false,
      });
    });

    it('works without cache', async function () {
      delete _cacheData['non-togglable'];
      delete _cacheData['default-on'];
      delete _cacheData['default-off'];
      delete _cacheData['default-off-infer-on'];

      expect(await currModulesEnabled(modules, createStore(), new NodePaths({ package: '' }))).toStrictEqual({
        'non-togglable': true,
        'default-on': true,
        'default-off': false,
        'default-off-infer-on': true,
      });
    });
  });

  describe('setModuleValue', function () {
    it('works', async function () {
      delete _cacheData['non-togglable'];
      delete _cacheData['default-on'];
      delete _cacheData['default-off'];
      delete _cacheData['default-off-infer-on'];

      await setModuleValue(modules[0], false, createStore(), new NodePaths({ package: '' }), cache);
      await setModuleValue(modules[1], false, createStore(), new NodePaths({ package: '' }), cache);
      await setModuleValue(modules[2], false, createStore(), new NodePaths({ package: '' }), cache);

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
    expect(async () =>
      applyModule(justFilesModule, { 'just-files': false }, {}, scaffoldDir, createStore(), new NodePaths({ package: '/ext' }))
    ).rejects.toThrow(new Error('Could not apply module "just-files", because it is not enabled in the provided module statuses.'));
  });

  it('errors if dependencies missing', async function () {
    const module = { ...justFilesModule, togglable: true, defaultEnabled: true, dependsOn: ['missing-dep', 'disabled-dep'] };
    expect(async () =>
      applyModule(module, { 'just-files': true, 'disabled-dep': false }, {}, scaffoldDir, createStore(), new NodePaths({ package: '/ext' }))
    ).rejects.toThrow(
      new Error('Could not apply module "just-files", because the following dependency modules are missing: "missing-dep, disabled-dep".')
    );
  });

  it('errors if module not present in modulesEnabled', async function () {
    expect(async () =>
      applyModule(justFilesModule, { somethingElse: true }, {}, scaffoldDir, createStore(), new NodePaths({ package: '/ext' }))
    ).rejects.toThrow(new Error('Could not apply module "just-files", because it is not enabled in the provided module statuses.'));
  });

  it('errors if missing template params', async function () {
    const module = { ...justFilesModule, needsTemplateParams: ['missing'] };

    expect(async () =>
      applyModule(module, { 'just-files': true }, { somethingElse: '42' }, scaffoldDir, createStore(), new NodePaths({ package: '/ext' }))
    ).rejects.toThrow(new Error('Could not apply module "just-files", because the following params are missing: "missing".'));
  });

  it('copies over files', async function () {
    const fs = await applyModule(justFilesModule, { 'just-files': true }, {}, scaffoldDir, createStore(), new NodePaths({ package: '/ext' }));

    expect(getFsPaths(fs)).toStrictEqual(justFilesModule.filesToReplace.map((p) => `/ext/${p}`));
    expect(getExtFileContents(fs, '.gitignore')).toStrictEqual('node_modules');
    expect(getExtFileContents(fs, 'readme.md')).toStrictEqual('# Sample Scaffolding\n');
  });

  it('can exclude files from being copied', async function () {
    const excludeScaffolding = { files: ['config2.json', 'src/index.ml'], configKeys: {} };
    const fs = await applyModule(
      justFilesModule,
      { 'just-files': true },
      {},
      scaffoldDir,
      createStore(),
      new NodePaths({ package: '/ext' }),
      excludeScaffolding
    );

    expect(getFsPaths(fs)).toStrictEqual(
      justFilesModule.filesToReplace.filter((f) => !excludeScaffolding.files.includes(typeof f === 'string' ? f : f.path)).map((p) => `/ext/${p}`)
    );
    expect(getExtFileContents(fs, '.gitignore')).toStrictEqual('node_modules');
    expect(getExtFileContents(fs, 'readme.md')).toStrictEqual('# Sample Scaffolding\n');
  });

  it('copies over files in monorepo config', async function () {
    const module: Module = {
      name: 'monorepo',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: [{ path: '.gitignore', destPath: '${params.someVar}.gitignore', monorepoPath: '${params.someVar}.gitignore' }, 'readme.md'],
      jsonToAugment: {},
      needsTemplateParams: ['someVar'],
    };

    const fs = await applyModule(
      module,
      { monorepo: true },
      { someVar: 'OCaml' },
      scaffoldDir,
      createStore(),
      new NodePaths({ package: '/ext', monorepo: '/ext/monorepo' })
    );

    expect(getFsPaths(fs)).toStrictEqual(['/ext/monorepo/OCaml.gitignore', '/ext/readme.md']);
  });

  it('copies over files with dest names', async function () {
    const module: Module = {
      name: 'monorepo',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: [{ path: '.gitignore', destPath: '${params.someVar}.gitignore' }, 'readme.md'],
      jsonToAugment: {},
      needsTemplateParams: ['someVar'],
    };

    const fs = await applyModule(module, { monorepo: true }, { someVar: 'OCaml' }, scaffoldDir, createStore(), new NodePaths({ package: '/ext' }));

    expect(getFsPaths(fs)).toStrictEqual(['/ext/OCaml.gitignore', '/ext/readme.md']);
  });

  it('copies over monorepo only files if in monorepo', async function () {
    const module: Module = {
      name: 'monorepo',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: [{ path: 'monorepo-only.ml', monorepoPath: 'monorepo-only.ml', requireMonorepo: true }],
      jsonToAugment: {},
      needsTemplateParams: ['someVar'],
    };

    const fs = await applyModule(
      module,
      { monorepo: true },
      { someVar: 'OCaml' },
      scaffoldDir,
      createStore(),
      new NodePaths({ package: '/ext', monorepo: '/ext/monorepo' })
    );

    expect(getFsPaths(fs)).toStrictEqual(['/ext/monorepo/monorepo-only.ml']);
  });

  it('doesnt copy over monorepo only files if not in monorepo', async function () {
    const module: Module = {
      name: 'monorepo',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: [{ path: 'monorepo-only.ml', monorepoPath: 'monorepo-only.ml', requireMonorepo: true }],
      jsonToAugment: {},
      needsTemplateParams: ['someVar'],
    };

    const fs = await applyModule(module, { monorepo: true }, { someVar: 'OCaml' }, scaffoldDir, createStore(), new NodePaths({ package: '/ext' }));

    expect(getFsPaths(fs)).toStrictEqual([]);
  });

  it('copies over JSON data', async function () {
    const module: Module = {
      name: 'just-json',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: [],
      jsonToAugment: { 'config1.json': ['nested.config.string', 'hello', '${params.varKey}++'] },
      needsTemplateParams: ['someVar', 'someOtherVar'],
    };

    const fs = await applyModule(
      module,
      { 'just-json': true },
      { someVar: 'val1', someOtherVar: 'val2', varKey: 'OCaml' },
      scaffoldDir,
      createStore(),
      new NodePaths({ package: '/ext' })
    );

    expect(getFsPaths(fs)).toStrictEqual(['/ext/config1.json']);
    expect(JSON.parse(getExtFileContents(fs, 'config1.json'))).toStrictEqual({
      hello: 'val1',
      'OCaml++': 'const',
      nested: { config: { string: 'a' } },
    });
  });

  it('can exclude JSON keys from being copied', async function () {
    const excludeScaffolding = { files: [], configKeys: { 'config1.json': ['nested.config.string', '${params.varKey}++'] } };
    const module: Module = {
      name: 'exclude-json',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: [],
      jsonToAugment: { 'config1.json': ['nested.config.string', 'hello', '${params.varKey}++'] },
      needsTemplateParams: ['someVar', 'someOtherVar'],
    };

    const fs = await applyModule(
      module,
      { 'exclude-json': true },
      { someVar: 'val1', someOtherVar: 'val2', varKey: 'OCaml' },
      scaffoldDir,
      createStore(),
      new NodePaths({ package: '/ext' }),
      excludeScaffolding
    );

    expect(getFsPaths(fs)).toStrictEqual(['/ext/config1.json']);
    expect(JSON.parse(getExtFileContents(fs, 'config1.json'))).toStrictEqual({
      hello: 'val1',
    });
  });

  it('copies over deep data', async function () {
    const module: Module = {
      name: 'just-json',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: [],
      jsonToAugment: { 'config1.json': ['nested.config', 'hello'] },
      needsTemplateParams: ['someVar', 'someOtherVar'],
    };

    const fs = await applyModule(
      module,
      { 'just-json': true },
      { someVar: 'val1', someOtherVar: 'val2' },
      scaffoldDir,
      createStore(),
      new NodePaths({ package: '/ext' })
    );

    expect(getFsPaths(fs)).toStrictEqual(['/ext/config1.json']);
    expect(JSON.parse(getExtFileContents(fs, 'config1.json'))).toStrictEqual({
      hello: 'val1',
      nested: { config: { string: 'a', boolean: true, null: null } },
    });
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
      new NodePaths({ package: '/ext' })
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

    await applyModule(module, { 'just-json': true }, { someVar: 'val1', someOtherVar: 'val2' }, scaffoldDir, fs, new NodePaths({ package: '/ext' }));

    expect(getFsPaths(fs)).toStrictEqual(['/ext/config1.json']);
    expect(JSON.parse(getExtFileContents(fs, 'config1.json'))).toStrictEqual({
      hello: 'val1',
      other: 'keep this',
      nested: { config: { string: 'hello', boolean: true }, somethingElse: 7 },
    });
  });

  it('doesnt copy over files if they depend on module without status info', async function () {
    const module: Module = {
      name: 'files-need-modules',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: ['readme.md', { path: '.gitignore', moduleDeps: ['missingModule'] }],
      jsonToAugment: {},
      needsTemplateParams: [],
    };

    const fs = await applyModule(module, { 'files-need-modules': true }, {}, scaffoldDir, createStore(), new NodePaths({ package: '/ext' }));

    expect(getFsPaths(fs)).toStrictEqual(['/ext/readme.md']);
  });

  it('doesnt copy over files if they depend on disabled modules', async function () {
    const module: Module = {
      name: 'files-need-modules',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: ['readme.md', { path: '.gitignore', moduleDeps: ['disabledModule'] }],
      jsonToAugment: {},
      needsTemplateParams: [],
    };

    const fs = await applyModule(
      module,
      { 'files-need-modules': true, disabledModule: false },
      {},
      scaffoldDir,
      createStore(),
      new NodePaths({ package: '/ext' })
    );

    expect(getFsPaths(fs)).toStrictEqual(['/ext/readme.md']);
  });

  it('copies over files if they depend on enabled modules', async function () {
    const module: Module = {
      name: 'files-need-modules',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: ['readme.md', { path: '.gitignore', moduleDeps: ['enabledModule'] }],
      jsonToAugment: {},
      needsTemplateParams: [],
    };

    const fs = await applyModule(
      module,
      { 'files-need-modules': true, enabledModule: true },
      {},
      scaffoldDir,
      createStore(),
      new NodePaths({ package: '/ext' })
    );

    expect(getFsPaths(fs)).toStrictEqual(['/ext/.gitignore', '/ext/readme.md']);
  });

  it('doesnt error when initializing non-updatable module', async function () {
    const module: Module = { ...justFilesModule, updatable: false };

    const fs = await applyModule(
      module,
      { 'just-files': true },
      {},
      scaffoldDir,
      createStore(),
      new NodePaths({ package: '/ext' }),
      { files: [], configKeys: {} },
      true
    );

    expect(getFsPaths(fs)).toStrictEqual(['/ext/.gitignore', '/ext/readme.md']);
  });

  it('errors when trying to update non-updatable module', async function () {
    const module: Module = { ...justFilesModule, updatable: false };

    expect(async () => {
      await applyModule(module, { 'just-files': true }, {}, scaffoldDir, createStore(), new NodePaths({ package: '/ext' }));
    }).rejects.toThrow('Cannot update module "just-files", as it is not updatable, and has already been initialized.');
  });

  it('creates doNotUpdate files if they dont exist', async function () {
    const module: Module = {
      name: 'files-need-modules',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: [{ path: 'readme.md', doNotUpdate: true }],
      jsonToAugment: {},
      needsTemplateParams: [],
    };

    const fs = await applyModule(
      module,
      { 'files-need-modules': true, enabledModule: true },
      {},
      scaffoldDir,
      createStore(),
      new NodePaths({ package: '/ext' })
    );

    expect(getFsPaths(fs)).toStrictEqual(['/ext/readme.md']);
    expect(create(fs).read('/ext/readme.md')).toEqual('# Sample Scaffolding\n');
  });

  it('doesnt update doNotUpdate files if they already exist', async function () {
    const module: Module = {
      name: 'files-need-modules',
      togglable: false,
      updatable: true,
      shortDescription: '',
      filesToReplace: [{ path: 'readme.md', doNotUpdate: true }],
      jsonToAugment: {},
      needsTemplateParams: [],
    };

    const fs = createStore();

    create(fs).write('/ext/readme.md', 'DO NOT OVERWRITE');

    await applyModule(module, { 'files-need-modules': true, enabledModule: true }, {}, scaffoldDir, fs, new NodePaths({ package: '/ext' }));

    expect(getFsPaths(fs)).toStrictEqual(['/ext/readme.md']);
    expect(create(fs).read('/ext/readme.md')).toEqual('DO NOT OVERWRITE');
  });
});
