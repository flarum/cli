
import globby from 'globby';
import { resolve } from 'path';
import { ExtensionSkeleton } from '../../../src/steps/init/extension-skeleton';
import { getExtFileContents, getFsPaths, runStep } from '../../utils';

async function getExpected(): Promise<string[]> {
  const skeletonDir = resolve(`${__dirname}/../../../boilerplate/skeleton/extension`);
  const skeletonPaths = await globby(`${skeletonDir}/**/*`, { dot: true });

  return [...skeletonPaths, `${skeletonDir}/LICENSE.md`].map(path => path.replace(skeletonDir, '/ext')).sort();
}

describe('Test extension skeleton step', function () {
  test('Includes all files when requested', async function () {
    const { fs } = await runStep(ExtensionSkeleton, [], {
      packageName: 'flarum/test',
      packageDescription: 'Text ext description',
      namespace: 'Flarum\\Test',
      authorName: 'Flarum Team',
      authorEmail: 'flarum@flarum.org',
      license: 'MIT',
      extensionName: 'Flarum Test',
      admin: true,
      forum: true,
      useLocale: true,
      useJs: true,
      useCss: true,
      useActionsCi: true,
      mainGitBranch: 'main',
    });

    const expected = await getExpected();

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
  });

  test('Can exclude locales', async function () {
    const { fs } = await runStep(ExtensionSkeleton, [], {
      packageName: 'flarum/test',
      packageDescription: 'Text ext description',
      namespace: 'Flarum\\Test',
      authorName: 'Flarum Team',
      authorEmail: 'flarum@flarum.org',
      license: 'MIT',
      extensionName: 'Flarum Test',
      admin: true,
      forum: true,
      useLocale: false,
      useJs: true,
      useCss: true,
      useActionsCi: true,
      mainGitBranch: 'main',
    });

    const expected = (await getExpected())
      .filter(path => !path.includes('/locale'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
  });

  test('Can exclude JS completely', async function () {
    const { fs } = await runStep(ExtensionSkeleton, [], {
      packageName: 'flarum/test',
      packageDescription: 'Text ext description',
      namespace: 'Flarum\\Test',
      authorName: 'Flarum Team',
      authorEmail: 'flarum@flarum.org',
      license: 'MIT',
      extensionName: 'Flarum Test',
      admin: true,
      forum: true,
      useLocale: true,
      useJs: false,
      useCss: true,
      useActionsCi: true,
      mainGitBranch: 'main',
    });

    const expected = (await getExpected())
      .filter(path => !path.includes('/js'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
  });

  test('Can exclude CSS completely', async function () {
    const { fs } = await runStep(ExtensionSkeleton, [], {
      packageName: 'flarum/test',
      packageDescription: 'Text ext description',
      namespace: 'Flarum\\Test',
      authorName: 'Flarum Team',
      authorEmail: 'flarum@flarum.org',
      license: 'MIT',
      extensionName: 'Flarum Test',
      admin: true,
      forum: true,
      useLocale: true,
      useJs: true,
      useCss: false,
      useActionsCi: true,
      mainGitBranch: 'main',
    });

    const expected = (await getExpected())
      .filter(path => !path.includes('/less'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(false);
  });

  test('Can exclude admin portion', async function () {
    const { fs } = await runStep(ExtensionSkeleton, [], {
      packageName: 'flarum/test',
      packageDescription: 'Text ext description',
      namespace: 'Flarum\\Test',
      authorName: 'Flarum Team',
      authorEmail: 'flarum@flarum.org',
      license: 'MIT',
      extensionName: 'Flarum Test',
      admin: false,
      forum: true,
      useLocale: true,
      useJs: true,
      useCss: true,
      useActionsCi: true,
      mainGitBranch: 'main',
    });

    const expected = (await getExpected())
      .filter(path => !path.includes('admin'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(false);
  });

  test('Can exclude forum portion', async function () {
    const { fs } = await runStep(ExtensionSkeleton, [], {
      packageName: 'flarum/test',
      packageDescription: 'Text ext description',
      namespace: 'Flarum\\Test',
      authorName: 'Flarum Team',
      authorEmail: 'flarum@flarum.org',
      license: 'MIT',
      extensionName: 'Flarum Test',
      admin: true,
      forum: false,
      useLocale: true,
      useJs: true,
      useCss: true,
      useActionsCi: true,
      mainGitBranch: 'main',
    });

    const expected = (await getExpected())
      .filter(path => !path.includes('forum'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
  });

  test('Can exclude Actions CI', async function () {
    const { fs } = await runStep(ExtensionSkeleton, [], {
      packageName: 'flarum/test',
      packageDescription: 'Text ext description',
      namespace: 'Flarum\\Test',
      authorName: 'Flarum Team',
      authorEmail: 'flarum@flarum.org',
      license: 'MIT',
      extensionName: 'Flarum Test',
      admin: true,
      forum: false,
      useLocale: true,
      useJs: true,
      useCss: true,
      useActionsCi: false,
      mainGitBranch: '',
    });

    const expected = (await getExpected())
      .filter(path => !path.includes('.github/workflows'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
  });

  test('Can set main git branch for Actions CI', async function () {
    const { fs } = await runStep(ExtensionSkeleton, [], {
      packageName: 'flarum/test',
      packageDescription: 'Text ext description',
      namespace: 'Flarum\\Test',
      authorName: 'Flarum Team',
      authorEmail: 'flarum@flarum.org',
      license: 'MIT',
      extensionName: 'Flarum Test',
      admin: true,
      forum: true,
      useLocale: true,
      useJs: true,
      useCss: true,
      useActionsCi: true,
      mainGitBranch: 'my/prod/branch',
    });

    const expected = await getExpected();

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/forum.js'")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/forum.less')")).toBe(false);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/js/dist/admin.js'")).toBe(true);
    expect(getExtFileContents(fs, 'extend.php').includes("__DIR__.'/less/admin.less'")).toBe(true);
    expect(getExtFileContents(fs, '.github/workflows/js.yml').includes("'refs/heads/my/prod/branch'")).toBe(true);
  });
});
