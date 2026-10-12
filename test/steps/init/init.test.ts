import globby from 'globby';
import { resolve } from 'path';
import { getComposerJson } from '../../../src/utils/composer';
import { genExtScaffolder } from '../../../src/steps/gen-ext-scaffolder';
import { getExtFileContents, getFsPaths, runStep, stubPathsFactory } from '../../boilersmith/utils';
import { Store } from 'mem-fs';

async function getExpected(ts = true): Promise<string[]> {
  const skeletonDir = resolve(`${__dirname}/../../../boilerplate/skeleton/extension`);
  const skeletonPaths = await globby(`${skeletonDir}/**/*`, { dot: true });

  return [...skeletonPaths]
    .map((path) => path.replace(skeletonDir, '/ext').replace('gitignore', '.gitignore'))
    .filter((path) => path.includes('webpack') || !path.endsWith(ts ? '.js' : '.ts'))
    .filter((path) => path !== 'monorepo-only.ml')
    .sort();
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
    jsPackageManager: 'yarn',
    advancedInstallation: true,
    'modules.admin': true,
    'modules.forum': true,
    'modules.js': true,
    'modules.jsCommon': true,
    'modules.css': true,
    'modules.locale': true,
    'modules.gitConf': true,
    'modules.githubActions': true,
    'modules.prettier': true,
    'modules.typescript': true,
    'modules.bundlewatch': true,
    'modules.backendTesting': true,
    'modules.phpstan': true,
    'modules.editorConfig': true,
    'modules.styleci': true,
    'modules.frontendTesting': true,
  };
  const initStep = genExtScaffolder().genInitStep();

  function buildModules(disabled: string[]) {
    const modules: Record<string, boolean> = {};

    Object.keys(vars).forEach((key) => {
      if (key.startsWith('modules.')) {
        modules[key.replace('modules.', '')] = Boolean(vars[key as keyof typeof vars]);
      }
    });

    disabled.forEach((key) => {
      modules[key] = false;
    });

    return modules;
  }

  test('Includes all default modules by default', async function () {
    const { fs } = await runStep(initStep, {}, { usePrompts: false, initialParams: { ...vars, advancedInstallation: false } });

    const expected = await getExpected();

    expect(getFsPaths(fs).sort()).toStrictEqual(
      expected.filter((p) => !p.includes('.bundlewatch') && !p.includes('.neon') && !p.includes('phpstan.yml'))
    );
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
    expect(await getEnabledModules(fs)).toStrictEqual(buildModules(['bundlewatch', 'phpstan']));
  });
  test('Includes all files when requested', async function () {
    const { fs } = await runStep(initStep, {}, { usePrompts: false, initialParams: vars });

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
    const { fs } = await runStep(initStep, {}, { usePrompts: false, initialParams: { ...vars, 'modules.locale': false } });

    const expected = (await getExpected()).filter((path) => !path.includes('/locale/'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
    expect(await getEnabledModules(fs)).toStrictEqual(buildModules(['locale']));
  });

  test('Can exclude JS completely', async function () {
    const { fs } = await runStep(initStep, {}, { usePrompts: false, initialParams: { ...vars, 'modules.js': false } });

    const expected = (await getExpected()).filter((path) => !path.includes('/js/') && !path.includes('frontend.yml'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
    expect(await getEnabledModules(fs)).toStrictEqual(buildModules(['js', 'jsCommon', 'typescript', 'bundlewatch', 'prettier', 'frontendTesting']));
  });

  test('Can exclude TS completely', async function () {
    const { fs } = await runStep(initStep, {}, { usePrompts: false, initialParams: { ...vars, 'modules.typescript': false } });

    const expected = (await getExpected(false)).filter((path) => !path.includes('tsconfig.json'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
    expect(await getEnabledModules(fs)).toStrictEqual(buildModules(['typescript']));
  });

  test('Can exclude CSS completely', async function () {
    const { fs } = await runStep(initStep, {}, { usePrompts: false, initialParams: { ...vars, 'modules.css': false } });

    const expected = (await getExpected()).filter((path) => !path.includes('/less/'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(false);
    expect(await getEnabledModules(fs)).toStrictEqual(buildModules(['css']));
  });

  test('Can exclude Actions CI', async function () {
    const { fs } = await runStep(initStep, {}, { usePrompts: false, initialParams: { ...vars, 'modules.githubActions': false } });

    const expected = (await getExpected()).filter((path) => !path.includes('/.github/workflows/'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
    expect(await getEnabledModules(fs)).toStrictEqual(buildModules(['githubActions']));
  });

  test('Can set main git branch for Actions CI', async function () {
    const { fs } = await runStep(initStep, {}, { usePrompts: false, initialParams: { ...vars, mainGitBranch: 'my/prod/branch' } });

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

  test('Adds scripts to run only the tests whose name matches', async function () {
    const { fs } = await runStep(initStep, {}, { usePrompts: false, initialParams: vars });

    const composerJson = JSON.parse(getExtFileContents(fs, 'composer.json'));

    expect(composerJson.scripts['test:unit:filter']).toBe('phpunit -c tests/phpunit.unit.xml --filter');
    expect(composerJson.scripts['test:integration:filter']).toBe('phpunit -c tests/phpunit.integration.xml --filter');
    expect(composerJson['scripts-descriptions']['test:unit:filter']).toBeDefined();
    expect(composerJson['scripts-descriptions']['test:integration:filter']).toBeDefined();
  });

  test('Leaves out every test script without backend testing', async function () {
    const { fs } = await runStep(initStep, {}, { usePrompts: false, initialParams: { ...vars, 'modules.backendTesting': false } });

    const composerJson = JSON.parse(getExtFileContents(fs, 'composer.json'));
    const testScripts = (scripts: Record<string, unknown> = {}) => Object.keys(scripts).filter((name) => name.startsWith('test'));

    expect(testScripts(composerJson.scripts)).toStrictEqual([]);
    expect(testScripts(composerJson['scripts-descriptions'])).toStrictEqual([]);
  });
});
