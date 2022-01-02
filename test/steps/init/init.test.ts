import globby from 'globby';
import { resolve } from 'node:path';
import { getComposerJson } from '../../../src/utils/composer';
import { genExtScaffolder } from '../../../src/steps/gen-ext-scaffolder';
import { getExtFileContents, getFsPaths, runStep, stubPathsFactory } from '../../boilersmith/utils';
import { Store } from 'mem-fs';

async function getExpected(): Promise<string[]> {
  const skeletonDir = resolve(`${__dirname}/../../../boilerplate/skeleton/extension`);
  const skeletonPaths = await globby(`${skeletonDir}/**/*`, { dot: true });

  return [...skeletonPaths].map(path => path.replace(skeletonDir, '/ext')).sort();
}

async function getEnabledModules(fs: Store) {
  const json = getComposerJson(fs, stubPathsFactory());

  return json.extra?.['flarum-cli']?.modules;
}

describe('Test extension skeleton step', function () {
  const vars = {
    packageName: 'flarum/test',
    packageDescription: 'Text ext description',
    packageNamespace: 'Flarum\\Test',
    authorName: 'Flarum Team',
    authorEmail: 'flarum@flarum.org',
    licenseType: 'MIT',
    extensionName: 'Flarum Test',
    mainGitBranch: 'main',
    advancedInstallation: true,
    'modules.js': true,
    'modules.css': true,
    'modules.locale': true,
    'modules.gitConf': true,
    'modules.githubActions': true,
    'modules.prettier': true,
    'modules.typescript': true,
    'modules.bundlewatch': true,
    'modules.backendTesting': true,
    'modules.editorConfig': true,
    'modules.styleci': true,
  };
  const initStep = genExtScaffolder().genInitStep();

  function buildModules(disabled: string[]) {
    const modules: Record<string, boolean> = {};

    Object.keys(vars).forEach(key => {
      if (key.startsWith('modules.')) {
        modules[key.replace('modules.', '')] = Boolean(vars[key as keyof typeof vars]);
      }
    });

    disabled.forEach(key => {
      modules[key] = false;
    });

    return modules;
  }

  test('Includes all default modules by default', async function () {
    const { fs } = await runStep(initStep, {}, [], { ...vars, advancedInstallation: false });

    const expected = await getExpected();

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
    expect(await getEnabledModules(fs)).toStrictEqual(buildModules(['bundlewatch']));
  });
  test('Includes all files when requested', async function () {
    const { fs } = await runStep(initStep, {}, [], vars);

    const expected = await getExpected();

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
    expect(await getEnabledModules(fs)).toStrictEqual(buildModules([]));
  });

  test('Can exclude locales', async function () {
    const { fs } = await runStep(initStep, {}, [], { ...vars, 'modules.locale': false });

    const expected = (await getExpected()).filter(path => !path.includes('/locale/'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
    expect(await getEnabledModules(fs)).toStrictEqual(buildModules(['locale']));
  });

  test('Can exclude JS completely', async function () {
    const { fs } = await runStep(initStep, {}, [], { ...vars, 'modules.js': false });

    const expected = (await getExpected()).filter(path => !path.includes('/js/'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
    expect(await getEnabledModules(fs)).toStrictEqual(buildModules(['js', 'typescript', 'bundlewatch', 'prettier']));
  });

  test('Can exclude CSS completely', async function () {
    const { fs } = await runStep(initStep, {}, [], { ...vars, 'modules.css': false });

    const expected = (await getExpected()).filter(path => !path.includes('/less/'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(false);
    expect(await getEnabledModules(fs)).toStrictEqual(buildModules(['css']));
  });

  test('Can exclude Actions CI', async function () {
    const { fs } = await runStep(initStep, {}, [], { ...vars, 'modules.githubActions': false });

    const expected = (await getExpected()).filter(path => !path.includes('/.github/workflows/'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
    expect(await getEnabledModules(fs)).toStrictEqual(buildModules(['githubActions']));
  });

  test('Can set main git branch for Actions CI', async function () {
    const { fs } = await runStep(initStep, {}, [], { ...vars, mainGitBranch: 'my/prod/branch' });

    const expected = await getExpected();

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
    expect(getExtFileContents(fs, '.github/workflows/frontend.yml').includes('my/prod/branch')).toBe(true);
    expect(await getEnabledModules(fs)).toStrictEqual(buildModules([]));
  });
});
