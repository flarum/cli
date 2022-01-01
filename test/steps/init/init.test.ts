import globby from 'globby';
import { resolve } from 'node:path';
import { genExtScaffolder } from '../../../src/steps/gen-ext-scaffolder';
import { getExtFileContents, getFsPaths, runStep } from '../../boilersmith/utils';

async function getExpected(): Promise<string[]> {
  const skeletonDir = resolve(`${__dirname}/../../../boilerplate/skeleton/extension`);
  const skeletonPaths = await globby(`${skeletonDir}/**/*`, { dot: true });

  return [...skeletonPaths, `${skeletonDir}/LICENSE.md`].map((path) => path.replace(skeletonDir, '/ext')).sort();
}

describe('Test extension skeleton step', function () {
  const vars = {
    'params.packageName': 'flarum/test',
    'params.packageDescription': 'Text ext description',
    'params.packageNamespace': 'Flarum\\Test',
    'params.authorName': 'Flarum Team',
    'params.authorEmail': 'flarum@flarum.org',
    'params.licenseType': 'MIT',
    'params.extensionName': 'Flarum Test',
    'params.mainGitBranch': 'main',
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
    'modules.editorconfig': true,
    'modules.styleci': true,
  };
  const initStep = genExtScaffolder().genInitStep();

  test('Includes all modules by default', async function () {
    const { fs } = await runStep(initStep, {}, [], {...vars, advancedInstallation: false});

    const expected = await getExpected();

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
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
  });

  test('Can exclude locales', async function () {
    const { fs } = await runStep(initStep, {}, [], { ...vars, 'modules.locale': false });

    const expected = (await getExpected()).filter((path) => !path.includes('/locale/'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
  });

  test('Can exclude JS completely', async function () {
    const { fs } = await runStep(initStep, {}, [], { ...vars, 'modules.js': false });

    const expected = (await getExpected()).filter((path) => !path.includes('/js/'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
  });

  test('Can exclude CSS completely', async function () {
    const { fs } = await runStep(initStep, {}, [], { ...vars, 'modules.css': false });

    const expected = (await getExpected()).filter((path) => !path.includes('/less/'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(false);
  });

  test('Can exclude Actions CI', async function () {
    const { fs } = await runStep(initStep, {}, [], { ...vars, 'modules.githubActions': false });

    const expected = (await getExpected()).filter((path) => !path.includes('/.github/workflows/'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
  });

  test('Can set main git branch for Actions CI', async function () {
    const { fs } = await runStep(initStep, {}, [], { ...vars, 'params.mainGitBranch': 'my/prod/branch' });

    const expected = await getExpected();

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
    expect(getExtFileContents(fs, '.github/workflows/frontend.yml').includes("'refs/heads/my/prod/branch'")).toBe(true);
  });
});
