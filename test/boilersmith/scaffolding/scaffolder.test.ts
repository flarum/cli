import { resolve } from 'node:path';
import { Scaffolder } from 'boilersmith/scaffolding/scaffolder';
import { getParamName, TemplateParam } from 'boilersmith/scaffolding/template-param';

describe('Scaffolder', function () {
  describe('Scaffolder.validate', function () {
    const scaffoldDir = resolve(__dirname, '../fixtures/example-scaffold');
    const allFiles = ['monorepo-only.ml', 'src/index.html', 'src/index.js', 'src/index.php', 'src/index.ml', '.gitignore', 'config1.json', 'config2.json', 'readme.md'];
    const filesNoConf = allFiles.filter(p => p !== 'config1.json');
    const configKeys = ['hello', 'foo', 'authors', '${params.varKey}++', 'nested.config.string', 'nested.config.boolean', 'nested.config.null'];

    const templateParams: TemplateParam<string, 'someVar' | 'someOtherVar' | 'varKey'>[] = [
      {
        prompt: { name: 'someVar', type: 'text' },
        getCurrVal: async () => '',
      },
      {
        prompt: { name: 'someOtherVar', type: 'text' },
        getCurrVal: async () => '',
      },
      {
        name: 'varKey',
        uses: [],
        compute: async () => 'OCaml',
      },
    ];
    const templateParamNames = templateParams.map(p => getParamName(p));

    it('errors when module dependencies missing', async function () {
      const scaffolder = new Scaffolder(scaffoldDir)
        .registerModule({
          name: 'Everything',
          shortDescription: 'Test module containing all files',
          togglable: true,
          defaultEnabled: true,
          dependsOn: ['missing1', 'missing2'],
          updatable: false,
          filesToReplace: allFiles,
          jsonToAugment: {},
          needsTemplateParams: templateParamNames,
        })
        .registerTemplateParam(templateParams[0])
        .registerTemplateParam(templateParams[1])
        .registerTemplateParam(templateParams[2]);

      expect(async () => scaffolder.validate()).rejects.toThrow(
        new Error(['Module "Everything" depends on modules that are not registered: "missing1, missing2".'].join('\n')),
      );
    });

    it('errors when files arent owned by modules', async function () {
      const scaffolder = new Scaffolder(scaffoldDir)
        .registerModule({
          name: 'Everything',
          shortDescription: 'Test module containing all files',
          togglable: false,
          updatable: false,
          filesToReplace: allFiles.slice(0, -3),
          jsonToAugment: {},
          needsTemplateParams: templateParamNames,
        })
        .registerTemplateParam(templateParams[0])
        .registerTemplateParam(templateParams[1])
        .registerTemplateParam(templateParams[2]);

      expect(async () => scaffolder.validate()).rejects.toThrow(
        new Error(
          [
            'File "config1.json" is not owned by any module.',
            'File "config2.json" is not owned by any module.',
            'File "readme.md" is not owned by any module.',
          ].join('\n'),
        ),
      );
    });

    it('errors when modules own nonexistent files', async function () {
      const scaffolder = new Scaffolder(scaffoldDir)
        .registerModule({
          name: 'Everything',
          shortDescription: 'Test module containing all files',
          togglable: false,
          updatable: false,
          filesToReplace: [...allFiles, 'src/index.hs'],
          jsonToAugment: {},
          needsTemplateParams: templateParamNames,
        })
        .registerTemplateParam(templateParams[0])
        .registerTemplateParam(templateParams[1])
        .registerTemplateParam(templateParams[2]);

      expect(async () => scaffolder.validate()).rejects.toThrow(
        new Error(['File "src/index.hs" is owned by modules: "Everything", but it doesn\'t exist in the scaffolding directory.'].join('\n')),
      );
    });

    it('errors when JSON with nonexistent keys are owned by files', async function () {
      const scaffolder = new Scaffolder(scaffoldDir)
        .registerModule({
          name: 'Everything',
          shortDescription: 'Test module containing all files',
          togglable: false,
          updatable: false,
          filesToReplace: allFiles,
          jsonToAugment: { 'doesntExist.json': ['hello', 'foo.bar'] },
          needsTemplateParams: templateParamNames,
        })
        .registerTemplateParam(templateParams[0])
        .registerTemplateParam(templateParams[1])
        .registerTemplateParam(templateParams[2]);

      expect(async () => scaffolder.validate()).rejects.toThrow(
        new Error(['File "doesntExist.json" has keys owned by modules: "Everything", but it doesn\'t exist in the scaffolding directory.'].join('\n')),
      );
    });

    it('errors when JSON with owned keys is also owned as a file', async function () {
      const scaffolder = new Scaffolder(scaffoldDir)
        .registerModule({
          name: 'Everything',
          shortDescription: 'Test module containing all files',
          togglable: false,
          updatable: false,
          filesToReplace: allFiles,
          jsonToAugment: { 'config1.json': configKeys },
          needsTemplateParams: templateParamNames,
        })
        .registerTemplateParam(templateParams[0])
        .registerTemplateParam(templateParams[1])
        .registerTemplateParam(templateParams[2]);

      expect(async () => scaffolder.validate()).rejects.toThrow(
        new Error(['File "config1.json" is owned by modules: "Everything". However, it also has keys that are owned by modules: "Everything".'].join('\n')),
      );
    });

    it('errors when JSON has some unowned keys', async function () {
      const scaffolder = new Scaffolder(scaffoldDir)
        .registerModule({
          name: 'Everything',
          shortDescription: 'Test module containing all files',
          togglable: false,
          updatable: false,
          filesToReplace: filesNoConf,
          jsonToAugment: { 'config1.json': configKeys.slice(0, -2) },
          needsTemplateParams: templateParamNames,
        })
        .registerTemplateParam(templateParams[0])
        .registerTemplateParam(templateParams[1])
        .registerTemplateParam(templateParams[2]);

      expect(async () => scaffolder.validate()).rejects.toThrow(
        new Error(
          [
            'Key "nested.config.boolean" in file "config1.json" is not owned by any module.',
            'Key "nested.config.null" in file "config1.json" is not owned by any module.',
          ].join('\n'),
        ),
      );
    });

    it('errors when owned JSON keys do not exist', async function () {
      const scaffolder = new Scaffolder(scaffoldDir)
        .registerModule({
          name: 'Everything',
          shortDescription: 'Test module containing all files',
          togglable: false,
          updatable: false,
          filesToReplace: filesNoConf,
          jsonToAugment: { 'config1.json': [...configKeys, 'nonexistent.key'] },
          needsTemplateParams: templateParamNames,
        })
        .registerTemplateParam(templateParams[0])
        .registerTemplateParam(templateParams[1])
        .registerTemplateParam(templateParams[2]);

      expect(async () => scaffolder.validate()).rejects.toThrow(
        new Error(['Key "nonexistent.key" is owned by modules: "Everything", but does not exist in file "config1.json".'].join('\n')),
      );
    });

    it('errors on missing template param', async function () {
      const scaffolder = new Scaffolder(scaffoldDir)
        .registerModule({
          name: 'Everything',
          shortDescription: 'Test module containing all files',
          togglable: false,
          updatable: false,
          filesToReplace: allFiles,
          jsonToAugment: {},
          needsTemplateParams: templateParamNames,
        })
        .registerTemplateParam(templateParams[0])
        .registerTemplateParam(templateParams[2]);

      expect(async () => scaffolder.validate()).rejects.toThrow(
        new Error(['Template param "someOtherVar" is used by modules: "Everything", but is not provided.'].join('\n')),
      );
    });

    it('errors on extra template param', async function () {
      const scaffolder = new Scaffolder(scaffoldDir)
        .registerModule({
          name: 'Everything',
          shortDescription: 'Test module containing all files',
          togglable: false,
          updatable: false,
          filesToReplace: allFiles,
          jsonToAugment: {},
          needsTemplateParams: ['someVar'],
        })
        .registerTemplateParam(templateParams[0])
        .registerTemplateParam(templateParams[1])
        .registerTemplateParam(templateParams[2]);

      expect(async () => scaffolder.validate()).rejects.toThrow(
        new Error(
          ['Template param "someOtherVar" is defined, but not used by any modules.', 'Template param "varKey" is defined, but not used by any modules.'].join(
            '\n',
          ),
        ),
      );
    });

    it('errors when computable template params are missing dependencies', async function () {
      const scaffolder = new Scaffolder(scaffoldDir)
        .registerModule({
          name: 'Everything',
          shortDescription: 'Test module containing all files',
          togglable: false,
          updatable: false,
          filesToReplace: filesNoConf,
          jsonToAugment: { 'config1.json': [...configKeys, 'nonexistent.key'] },
          needsTemplateParams: templateParamNames,
        })
        .registerTemplateParam(templateParams[0]);

      expect(() =>
        scaffolder.registerTemplateParam({
          name: 'someOtherVar',
          uses: ['missing1', 'missing2'],
          compute: async () => '',
        }),
      ).toThrow(new Error(['Computed template param "someOtherVar" is missing dependency params: "missing1, missing2".'].join('\n')));
    });
  });
});
