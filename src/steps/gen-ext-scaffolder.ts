import { Paths } from 'boilersmith/paths';
import { Module, ModuleStatusCache } from 'boilersmith/scaffolding/module';
import { Scaffolder } from 'boilersmith/scaffolding/scaffolder';
import { TemplateParam } from 'boilersmith/scaffolding/template-param';
import chalk from 'chalk';
import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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

  'jsPackageManager',

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
          validate: (s) => /^([\dA-Za-z-]{2,})\/([\dA-Za-z-]{2,})$/.test(s.trim()) || 'Invalid package name format',
          format: (s) => s.toLowerCase(),
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
          validate: (s) => /^([\dA-Za-z]+)\\([\dA-Za-z]+)$/.test(s.trim()) || 'Invalid namespace format',
          format: (str: string) =>
            str &&
            str
              .split('\\')
              .map((s) => s[0].toUpperCase() + s.slice(1))
              .join('\\'),
        },
        getCurrVal: async (fs: Store, paths: Paths) => {
          const json = getComposerJson(fs, paths);
          const namespace = (Object.keys(json?.autoload?.['psr-4'] ?? {})?.[0] ?? '')?.slice(0, -1);
          return namespace || '';
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
          validate: (s) => !s || /^[\w!#$%&*+./=?^`{|}~’-]+@[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*$/.test(s) || 'Invalid email format',
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
          validate: (str) => Boolean(str.trim()) || 'The extension name is required',
          format: (str) =>
            str
              .split(' ')
              .map((s: string) => (s.length > 3 ? s[0].toUpperCase() + s.slice(1) : s))
              .join(' '),
        },
        getCurrVal: async (fs: Store, paths: Paths) => {
          const json = getComposerJson(fs, paths);
          if (json.name === 'flarum/core') return 'Core';
          return json?.extra?.['flarum-extension']?.title ?? '';
        },
      };

    case 'licenseType':
      return {
        prompt: {
          name,
          type: 'autocomplete',
          message: 'License',
          choices: [...(spdxLicenseListSimple as Set<string>)].map((e) => ({ title: e, value: e })),
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
          validate: (s) =>
            /^(?!.*\/\.)(?!.*\.\.)(?!\/)(?!.*\/\/)(?!.*@{)(?!.*\\)[^\000-\037 *:?[^~\177]+(?<!\.lock)(?<!\/)(?<!\.)$/.test(s.trim()) ||
            'Invalid git branch',
          initial: 'main',
        },
        getCurrVal: async (_fs, paths) => {
          const cwd = paths.monorepo() ?? paths.package();
          try {
            const remotes = execSync('git remote', { cwd, timeout: 2000 }).toString().split('\n');
            if (remotes.includes('origin')) {
              return execSync("git remote show origin | grep 'HEAD branch' | cut -d' ' -f5", { cwd }).toString();
            }
          } catch {}

          return (await simpleGit(cwd).getConfig('init.defaultBranch')).value ?? 'main';
        },
      };

    case 'jsPackageManager':
      return {
        prompt: {
          name,
          type: 'select',
          message: 'JS Package Manager',
          initial: 'yarn',
          choices: [
            { title: 'Yarn', value: 'yarn' },
            { title: 'NPM', value: 'npm' },
          ],
        },
        getCurrVal: async (fs: Store, paths: Paths) => {
          return create(fs).exists(paths.package('js/yarn.lock')) ? 'yarn' : 'npm';
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
          return monorepoPath ? paths.package().replace(monorepoPath, '.') + '/js' : './js';
        },
      };
  }

  return assertUnreachable(name);
}

export const EXTENSION_MODULES = [
  'core',
  'icon',

  'admin',
  'forum',

  'js',
  'jsCommon',
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
        filesToReplace: ['extend.php', 'README.md', 'LICENSE.md'],
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
            'minimum-stability',
            'prefer-stable',
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

    case 'admin':
      return {
        name,
        updatable: true,
        defaultEnabled: true,
        dependsOn: [],
        togglable: true,
        shortDescription: 'Admin Frontend',
        filesToReplace: [
          { path: 'js/admin.js', moduleDeps: ['js', { module: 'typescript', enabled: false }] },
          { path: 'js/admin.ts', moduleDeps: ['js', { module: 'typescript', enabled: true }] },
          { path: 'js/src/admin/index.js', doNotUpdate: true, moduleDeps: ['js', { module: 'typescript', enabled: false }] },
          { path: 'js/src/admin/index.ts', doNotUpdate: true, moduleDeps: ['js', { module: 'typescript', enabled: true }] },
        ],
        jsonToAugment: {},
        needsTemplateParams: [],
        inferEnabled: async (_fs, paths: Paths) => {
          if (!existsSync(paths.package('js'))) undefined;
          return existsSync(paths.package('js/src/admin'));
        },
      };
    case 'forum':
      return {
        name,
        updatable: true,
        defaultEnabled: true,
        dependsOn: [],
        togglable: true,
        shortDescription: 'Forum Frontend',
        filesToReplace: [
          { path: 'js/forum.js', moduleDeps: ['js', { module: 'typescript', enabled: false }] },
          { path: 'js/forum.ts', moduleDeps: ['js', { module: 'typescript', enabled: true }] },
          { path: 'js/src/forum/index.js', doNotUpdate: true, moduleDeps: ['js', { module: 'typescript', enabled: false }] },
          { path: 'js/src/forum/index.ts', doNotUpdate: true, moduleDeps: ['js', { module: 'typescript', enabled: true }] },
        ],
        jsonToAugment: {},
        needsTemplateParams: [],
        inferEnabled: async (_fs, paths: Paths) => {
          if (!existsSync(paths.package('js'))) undefined;
          return existsSync(paths.package('js/src/forum'));
        },
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
        filesToReplace: [
          'js/webpack.config.js',
          { path: 'js/admin.js', moduleDeps: ['admin', { module: 'typescript', enabled: false }] },
          { path: 'js/forum.js', moduleDeps: ['forum', { module: 'typescript', enabled: false }] },
          { path: 'js/admin.ts', moduleDeps: ['admin', { module: 'typescript', enabled: true }] },
          { path: 'js/forum.ts', moduleDeps: ['forum', { module: 'typescript', enabled: true }] },
          { path: 'js/src/admin/index.js', doNotUpdate: true, moduleDeps: ['admin', { module: 'typescript', enabled: false }] },
          { path: 'js/src/forum/index.js', doNotUpdate: true, moduleDeps: ['forum', { module: 'typescript', enabled: false }] },
          { path: 'js/src/common/index.js', doNotUpdate: true, moduleDeps: ['jsCommon', { module: 'typescript', enabled: false }] },
          { path: 'js/src/admin/index.ts', doNotUpdate: true, moduleDeps: ['admin', { module: 'typescript', enabled: true }] },
          { path: 'js/src/forum/index.ts', doNotUpdate: true, moduleDeps: ['forum', { module: 'typescript', enabled: true }] },
          { path: 'js/src/common/index.ts', doNotUpdate: true, moduleDeps: ['jsCommon', { module: 'typescript', enabled: true }] },
        ],
        jsonToAugment: {
          'js/package.json': [
            'name',
            'private',
            'devDependencies.flarum-webpack-config',
            'devDependencies.webpack',
            'devDependencies.webpack-cli',
            'scripts.dev',
            'scripts.build',
            'scripts.analyze',
          ],
        },
        needsTemplateParams: ['packageName', 'jsPackageManager'],
        inferEnabled: async (_fs, paths: Paths) => {
          return existsSync(paths.package('js'));
        },
      };

    case 'jsCommon':
      return {
        name,
        updatable: true,
        togglable: true,
        defaultEnabled: true,
        shortDescription: 'JS common code',
        longDescription: 'Shared code between the forum and the admin frontends',
        dependsOn: ['js'],
        filesToReplace: [
          { path: 'js/admin.js', moduleDeps: ['admin', { module: 'typescript', enabled: false }] },
          { path: 'js/forum.js', moduleDeps: ['forum', { module: 'typescript', enabled: false }] },
          { path: 'js/admin.ts', moduleDeps: ['admin', { module: 'typescript', enabled: true }] },
          { path: 'js/forum.ts', moduleDeps: ['forum', { module: 'typescript', enabled: true }] },
          { path: 'js/src/common/index.js', doNotUpdate: true, moduleDeps: [{ module: 'typescript', enabled: false }] },
          { path: 'js/src/common/index.ts', doNotUpdate: true, moduleDeps: [{ module: 'typescript', enabled: true }] },
        ],
        jsonToAugment: {},
        needsTemplateParams: [],
        inferEnabled: async (_fs, paths: Paths) => {
          return existsSync(paths.package('js/src/common'));
        },
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
        filesToReplace: [
          { path: 'less/admin.less', doNotUpdate: true, moduleDeps: ['admin'] },
          { path: 'less/forum.less', doNotUpdate: true, moduleDeps: ['forum'] },
        ],
        jsonToAugment: {},
        needsTemplateParams: [],
        inferEnabled: async (_fs, paths: Paths) => {
          return existsSync(paths.package('less'));
        },
      };

    case 'locale':
      return {
        name,
        updatable: false,
        togglable: true,
        defaultEnabled: true,
        shortDescription: 'Locale',
        longDescription: 'Translation starter files.',
        dependsOn: [],
        filesToReplace: [{ path: 'locale/en.yml', doNotUpdate: true }],
        jsonToAugment: {},
        needsTemplateParams: [],
        inferEnabled: async (_fs, paths: Paths) => {
          return existsSync(paths.package('locale'));
        },
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
        filesToReplace: [
          { path: 'gitignore', destPath: '.gitignore' },
          { path: 'js/gitignore', moduleDeps: ['js'], destPath: 'js/.gitignore' },
          '.gitattributes',
        ],
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
        filesToReplace: [
          {
            path: '.github/workflows/frontend.yml',
            monorepoPath: '.github/workflows/${params.extensionId}-frontend.yml',
            requireMonorepo: false,
            moduleDeps: ['js'],
          },
          {
            path: '.github/workflows/backend.yml',
            monorepoPath: '.github/workflows/${params.extensionId}-backend.yml',
            requireMonorepo: false,
          },
        ],
        jsonToAugment: {},
        needsTemplateParams: ['frontendDirectory', 'backendDirectory', 'mainGitBranch', 'extensionId', 'extensionName'],
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
          'js/package.json': [
            'prettier',
            'devDependencies.prettier',
            'devDependencies.@flarum/prettier-config',
            'scripts.format',
            'scripts.format-check',
          ],
        },
        needsTemplateParams: [],
        inferEnabled: async (_fs, paths: Paths) => {
          if (!existsSync(paths.package('js/package.json'))) {
            return false;
          }

          return readFileSync(paths.package('js/package.json')).includes('prettier');
        },
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
            'devDependencies.flarum-tsconfig',
            'devDependencies.typescript',
            'devDependencies.typescript-coverage-report',
            'scripts.clean-typings',
            'scripts.build-typings',
            'scripts.post-build-typings',
            'scripts.check-typings',
            'scripts.check-typings-coverage',
          ],
        },
        needsTemplateParams: [],
        inferEnabled: async (_fs, paths: Paths) => {
          return existsSync(paths.package('js/tsconfig.json'));
        },
      };

    case 'bundlewatch':
      return {
        name,
        updatable: true,
        togglable: true,
        defaultEnabled: false,
        shortDescription: 'Enable Bundlewatch Checks',
        dependsOn: ['js'],
        filesToReplace: ['js/.bundlewatch.config.json'],
        jsonToAugment: {},
        needsTemplateParams: [],
        inferEnabled: async (_fs, paths: Paths) => {
          return existsSync(paths.package('js/.bundlewatch.config.json'));
        },
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
        inferEnabled: async (_fs, paths: Paths) => {
          return existsSync(paths.package('tests'));
        },
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
        filesToReplace: [{ path: '.styleci.yml', monorepoPath: '.styleci.yml', requireMonorepo: false }],
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
      return !module.togglable || json?.extra?.['flarum-cli']?.modules?.[module.name];
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

      create(fs).extendJSON(paths.package('composer.json'), json, undefined, 4);
    },
  };

  const excludeScaffoldingFunc = (fs: Store, paths: Paths) => {
    const json = getComposerJson(fs, paths);

    return {
      files: json?.extra?.['flarum-cli']?.excludeScaffolding ?? [],
      configKeys: json?.extra?.['flarum-cli']?.excludeScaffoldingConfigKeys ?? {},
    };
  };

  const scaffolder = new Scaffolder<ExtensionParams, ExtensionModules>(
    resolve(__dirname, '../../boilerplate/skeleton/extension'),
    moduleStatusCache,
    excludeScaffoldingFunc
  );

  for (const name of EXTENSION_MODULES) {
    scaffolder.registerModule(moduleNameToDef(name));
  }

  for (const name of EXTENSION_PARAMS) {
    scaffolder.registerTemplateParam(paramNamesToDef(name));
  }

  cached = scaffolder;

  return scaffolder;
}
