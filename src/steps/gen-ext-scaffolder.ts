import { Paths } from 'boilersmith/paths';
import { Module, ModuleStatusCache } from 'boilersmith/scaffolding/module';
import { Scaffolder } from 'boilersmith/scaffolding/scaffolder';
import { TemplateParam } from 'boilersmith/scaffolding/template-param';
import chalk from 'chalk';
import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { resolve } from 'node:path';
import simpleGit from 'simple-git';
import spdxLicenseListSimple from 'spdx-license-list/simple';
import { getComposerJson } from '../utils/composer';

function assertUnreachable(_x: never): never {
  throw new Error("Didn't expect to get here");
}

export const EXTENSION_PARAMS = [
  'packageName',
  'packageDescription',
  'packageNamespace',
  'authorName',
  'authorEmail',
  'extensionName',
  'licenseType',
  'mainGitBranch',

  'licenseText',

  'packageNamespaceEscapedSlash',
  'extensionId',
  'year',

  'backendDirectory',
  'frontendDirectory',
] as const;

export type ExtensionParams = typeof EXTENSION_PARAMS[number];

function paramNamesToDef(name: ExtensionParams): TemplateParam<string, ExtensionParams> {
  switch (name) {
  case 'packageName':
    return {
      prompt: {
        name,
        type: 'text',
        message: `Package ${chalk.dim('(vendor/extension-name)')}`,
        validate: s => /^([\dA-Za-z-]{2,})\/([\dA-Za-z-]{2,})$/.test(s.trim()) || 'Invalid package name format',
        format: s => s.toLowerCase(),
      },
      getCurrVal: async (fs: Store, paths: Paths) => {
        const json = getComposerJson(fs, paths);
        return json?.name;
      },
    };

  case 'packageDescription':
    return {
      prompt: {
        name,
        type: 'text',
        message: 'Package description',
      },
      getCurrVal: async (fs: Store, paths: Paths) => {
        const json = getComposerJson(fs, paths);
        return json?.description ?? '';
      },
    };

  case 'packageNamespace':
    return {
      prompt: {
        name,
        type: 'text',
        message: `Package namespace ${chalk.dim('(Vendor\\ExtensionName)')}`,
        validate: s => /^([\dA-Za-z]+)\\([\dA-Za-z]+)$/.test(s.trim()) || 'Invalid namespace format',
        format: (str: string) =>
          str &&
            str
              .split('\\')
              .map(s => s[0].toUpperCase() + s.slice(1))
              .join('\\'),
      },
      getCurrVal: async (fs: Store, paths: Paths) => {
        const json = getComposerJson(fs, paths);
        const namespace = (Object.keys(json?.autoload?.['psr-4'] ?? {})?.[0] ?? '')?.slice(0, -1);
        return namespace || undefined;
      },
    };

  case 'authorName':
    return {
      prompt: {
        name,
        type: 'text',
        message: 'Author name',
      },
      getCurrVal: async (fs: Store, paths: Paths) => {
        const json = getComposerJson(fs, paths);
        return json.authors?.[0]?.name ?? '';
      },
    };

  case 'authorEmail':
    return {
      prompt: {
        name,
        type: 'text',
        message: 'Author email',
        validate: s => !s || /^[\w!#$%&*+./=?^`{|}~’-]+@[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*$/.test(s) || 'Invalid email format',
      },
      getCurrVal: async (fs: Store, paths: Paths) => {
        const json = getComposerJson(fs, paths);
        return json.authors?.[0]?.email ?? '';
      },
    };

  case 'extensionName':
    return {
      prompt: {
        name,
        type: 'text',
        message: 'Extension name',
        validate: str => Boolean(str.trim()) || 'The extension name is required',
        format: str =>
          str
            .split(' ')
            .map((s: string) => (s.length > 3 ? s[0].toUpperCase() + s.slice(1) : s))
            .join(' '),
      },
      getCurrVal: async (fs: Store, paths: Paths) => {
        const json = getComposerJson(fs, paths);
        return json?.extra?.['flarum-extension']?.title ?? '';
      },
    };

  case 'licenseType':
    return {
      prompt: {
        name,
        type: 'autocomplete',
        message: 'License',
        choices: [...(spdxLicenseListSimple as Set<string>)].map(e => ({ title: e, value: e })),
      },
      getCurrVal: async (fs: Store, paths: Paths) => {
        const json = getComposerJson(fs, paths);
        return json?.license ?? '';
      },
    };

  case 'licenseText':
    return {
      name,
      uses: ['licenseType'],
      compute: async (_paths, licenseType: string) => (licenseType ? require(`spdx-license-list/licenses/${licenseType}`).licenseText : ''),
    };

  case 'packageNamespaceEscapedSlash':
    return {
      name,
      uses: ['packageNamespace'],
      compute: async (_paths, packageNamespace: string) => packageNamespace.replace('\\', '\\\\'),
    };

  case 'extensionId':
    return {
      name,
      uses: ['packageName'],
      compute: async (_paths, packageName) => packageName.replace(/(flarum-ext-)|(flarum-)/, '').replace('/', '-'),
    };

  case 'year':
    return {
      name,
      uses: [],
      compute: async () => new Date().getFullYear().toString(),
    };

  case 'mainGitBranch':
    return {
      prompt: {
        name,
        type: 'text',
        message: `Main git branch ${chalk.dim('(JS will automatically build when changes are pushed to GitHub on this branch)')}`,
        // See https://stackoverflow.com/a/12093994/11091039
        validate: s =>
          /^(?!.*\/\.)(?!.*\.\.)(?!\/)(?!.*\/\/)(?!.*@{)(?!.*\\)[^\000-\037 *:?[^~\177]+(?<!\.lock)(?<!\/)(?<!\.)$/.test(s.trim()) || 'Invalid git branch',
        initial: 'main',
      },
      getCurrVal: async () => {
        return (await simpleGit().getConfig('init.defaultBranch')).value ?? 'main';
      },
    };

  case 'backendDirectory':
    return {
      name,
      uses: [],
      compute: async (paths: Paths) => {
        const monorepoPath = paths.monorepo();
        return monorepoPath ? paths.package().replace(monorepoPath, '.') : '.';
      },
    };

  case 'frontendDirectory':
    return {
      name,
      uses: [],
      compute: async (paths: Paths) => {
        const monorepoPath = paths.monorepo();
        return monorepoPath ? paths.package().replace(monorepoPath, '.') + 'js' : './js';
      },
    };
  }

  return assertUnreachable(name);
}

export const EXTENSION_MODULES = [
  'core',
  'icon',

  'js',
  'css',
  'locale',

  'gitConf',
  'githubActions',

  'prettier',
  'typescript',
  'bundlewatch',

  'backendTesting',

  'editorConfig',
  'styleci',
] as const;

export type ExtensionModules = typeof EXTENSION_MODULES[number];

function moduleNameToDef(name: ExtensionModules): Module<ExtensionModules> {
  switch (name) {
  case 'core':
    return {
      name,
      updatable: false,
      togglable: false,
      shortDescription: 'Core Functionality',
      filesToReplace: [
        'extend.php',
        'README.md',
        'LICENSE.md',
        { path: 'js/src/admin/index.js', needsOtherModules: ['js'] },
        { path: 'js/src/forum/index.js', needsOtherModules: ['js'] },
      ],
      jsonToAugment: {
        'composer.json': [
          'name',
          'description',
          'keywords',
          'type',
          'license',
          'require.flarum/core',
          'authors',
          'autoload.psr-4.${params.packageNamespaceEscapedSlash}\\',
          'extra.flarum-extension.title',
          'extra.flarum-extension.category',
        ],
      },
      needsTemplateParams: [
        'packageName',
        'packageNamespace',
        'packageNamespaceEscapedSlash',
        'packageDescription',
        'extensionName',
        'licenseType',
        'licenseText',
        'authorName',
        'authorEmail',
        'extensionId',
        'year',
      ],
    };
  case 'icon':
    return {
      name,
      updatable: false,
      togglable: false,
      shortDescription: 'Extension Icon',
      filesToReplace: [],
      jsonToAugment: {
        'composer.json': ['extra.flarum-extension.icon.name', 'extra.flarum-extension.icon.color', 'extra.flarum-extension.icon.backgroundColor'],
      },
      needsTemplateParams: [],
    };

  case 'js':
    return {
      name,
      updatable: true,
      togglable: true,
      defaultEnabled: true,
      shortDescription: 'Javascript',
      longDescription: "Files, tools, and scripts to build Flarum's frontend.",
      dependsOn: [],
      filesToReplace: ['js/webpack.config.js', 'js/admin.js', 'js/forum.js'],
      jsonToAugment: {
        'js/package.json': [
          'name',
          'version',
          'private',
          'devDependencies.flarum-webpack-config',
          'devDependencies.webpack',
          'devDependencies.webpack-cli',
          'scripts.dev',
          'scripts.build',
          'scripts.analyze',
        ],
      },
      needsTemplateParams: ['packageName'],
    };

  case 'css':
    return {
      name,
      updatable: true,
      togglable: true,
      defaultEnabled: true,
      shortDescription: 'CSS',
      longDescription: "LESS starter files for Flarum's frontend styling.",
      dependsOn: [],
      filesToReplace: ['less/admin.less', 'less/forum.less'],
      jsonToAugment: {},
      needsTemplateParams: [],
    };

  case 'locale':
    return {
      name,
      updatable: true,
      togglable: true,
      defaultEnabled: true,
      shortDescription: 'Locale',
      longDescription: 'Translation starter files.',
      dependsOn: [],
      filesToReplace: ['locale/en.yml'],
      jsonToAugment: {},
      needsTemplateParams: [],
    };

  case 'gitConf':
    return {
      name,
      updatable: true,
      togglable: true,
      defaultEnabled: true,
      shortDescription: 'Git Configuration',
      longDescription: 'Git config files (e.g. .gitignore, .gitattributes).',
      dependsOn: [],
      filesToReplace: ['.gitignore', '.gitattributes'],
      jsonToAugment: {},
      needsTemplateParams: [],
    };

  case 'githubActions':
    return {
      name,
      updatable: true,
      togglable: true,
      defaultEnabled: true,
      shortDescription: 'GitHub Actions CI',
      longDescription: 'Automatically run checks via GitHub Actions CI. Free for open source projects.',
      dependsOn: [],
      filesToReplace: ['.github/workflows/frontend.yml', '.github/workflows/backend.yml'],
      jsonToAugment: {},
      needsTemplateParams: ['frontendDirectory', 'backendDirectory', 'mainGitBranch'],
    };

  case 'prettier':
    return {
      name,
      updatable: true,
      togglable: true,
      defaultEnabled: true,
      shortDescription: 'Auto-format frontend code with Prettier.',
      dependsOn: ['js'],
      filesToReplace: [],
      jsonToAugment: {
        'js/package.json': ['prettier', 'devDependencies.prettier', 'devDependencies.@flarum/prettier-config', 'scripts.format', 'scripts.format-check'],
      },
      needsTemplateParams: [],
    };

  case 'typescript':
    return {
      name,
      updatable: true,
      togglable: true,
      defaultEnabled: true,
      shortDescription: 'Support TypeScript in frontend code.',
      dependsOn: ['js'],
      filesToReplace: ['js/tsconfig.json'],
      jsonToAugment: {
        'js/package.json': [
          'prettier',
          'devDependencies.flarum-tsconfig',
          'devDependencies.typescript',
          'devDependencies.typescript-coverage-report',
          'scripts.check-typings',
          'scripts.check-typings-coverage',
        ],
      },
      needsTemplateParams: [],
    };

  case 'bundlewatch':
    return {
      name,
      updatable: true,
      togglable: true,
      defaultEnabled: false,
      shortDescription: 'Enable Bundlewatch Checks',
      dependsOn: ['js'],
      filesToReplace: [],
      jsonToAugment: {},
      needsTemplateParams: [],
    };

  case 'backendTesting':
    return {
      name,
      updatable: true,
      togglable: true,
      defaultEnabled: true,
      shortDescription: 'Backend PHP unit and integration testing via PHPUnit.',
      dependsOn: [],
      filesToReplace: [
        'tests/phpunit.integration.xml',
        'tests/phpunit.unit.xml',
        'tests/fixtures/.gitkeep',
        'tests/integration/setup.php',
        'tests/unit/.gitkeep',
      ],
      jsonToAugment: {
        'composer.json': [
          'autoload-dev.psr-4.${params.packageNamespaceEscapedSlash}\\Tests\\',
          'scripts.test',
          'scripts.test:unit',
          'scripts.test:integration',
          'scripts.test:setup',
          'scripts-descriptions.test',
          'scripts-descriptions.test:unit',
          'scripts-descriptions.test:integration',
          'scripts-descriptions.test:setup',
          'require-dev.flarum/testing',
        ],
      },
      needsTemplateParams: ['packageNamespaceEscapedSlash'],
    };

  case 'editorConfig':
    return {
      name,
      updatable: true,
      togglable: true,
      defaultEnabled: true,
      shortDescription: 'EditorConfig setup',
      dependsOn: [],
      filesToReplace: ['.editorconfig'],
      jsonToAugment: {},
      needsTemplateParams: [],
    };

  case 'styleci':
    return {
      name,
      updatable: true,
      togglable: true,
      defaultEnabled: true,
      shortDescription: 'StyleCI config file',
      dependsOn: [],
      filesToReplace: ['.styleci.yml'],
      jsonToAugment: {},
      needsTemplateParams: [],
    };
  }

  return assertUnreachable(name);
}

let cached: Scaffolder<ExtensionParams, ExtensionModules>;

export function genExtScaffolder(): Scaffolder<ExtensionParams, ExtensionModules> {
  if (cached) return cached;

  const moduleStatusCache: ModuleStatusCache<ExtensionModules> = {
    get: async (module: Module<ExtensionModules>, fs: Store, paths: Paths) => {
      const json = getComposerJson(fs, paths);
      return !module.togglable || (json?.extra?.['flarum-cli']?.modules?.[module.name] ?? module.defaultEnabled);
    },
    set: async (module: Module<ExtensionModules>, enabled: boolean, fs: Store, paths: Paths) => {
      const json = {
        extra: {
          'flarum-cli': {
            modules: {
              [module.name]: enabled,
            },
          },
        },
      };

      create(fs).extendJSON(paths.package('composer.json'), json);
    },
  };

  const scaffolder = new Scaffolder<ExtensionParams, ExtensionModules>(resolve(__dirname, '../../boilerplate/skeleton/extension'), moduleStatusCache);

  for (const name of EXTENSION_MODULES) {
    scaffolder.registerModule(moduleNameToDef(name));
  }

  for (const name of EXTENSION_PARAMS) {
    scaffolder.registerTemplateParam(paramNamesToDef(name));
  }

  cached = scaffolder;

  return scaffolder;
}
