
import globby from 'globby';
import { resolve } from 'path';
import { ExtensionSkeleton } from '../../../src/steps/init/extension-skeleton';
import { getExtFileContents, getFsPaths, runStep } from '../../utils';

async function getExpected(): Promise<string[]> {
  const skeletonDir = resolve(`${__dirname}/../../../boilerplate/skeleton/extension`);
  const skeletonPaths = await globby(`${skeletonDir}/**/*`, { dot: true });

  return [...skeletonPaths, skeletonDir, `${skeletonDir}/LICENSE.md`].map(path => path.replace(skeletonDir, '/ext')).sort();
}

describe('Test extension skeleton step', function () {
  test('Includes all files when requested', async function () {
    const fs = await runStep(ExtensionSkeleton, {
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
    });

    const expected = await getExpected();

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(true);
  });

  test('Can exclude locales', async function () {
    const fs = await runStep(ExtensionSkeleton, {
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
    });

    const expected = (await getExpected())
      .filter(path => !path.includes('/locale'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'extend.php').includes('Extend\\Locales')).toBe(false);
  });

  test('Can exclude JS completely', async function () {
    const fs = await runStep(ExtensionSkeleton, {
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
    });

    const expected = (await getExpected())
      .filter(path => !path.includes('/js'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
  });

  test('Can exclude CSS completely', async function () {
    const fs = await runStep(ExtensionSkeleton, {
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
    });

    const expected = (await getExpected())
      .filter(path => !path.includes('/less'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
  });

  test('Can exclude admin portion', async function () {
    const fs = await runStep(ExtensionSkeleton, {
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
    });

    const expected = (await getExpected())
      .filter(path => !path.includes('admin'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
  });

  test('Can exclude forum portion', async function () {
    const fs = await runStep(ExtensionSkeleton, {
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
    });

    const expected = (await getExpected())
      .filter(path => !path.includes('forum'));

    expect(getFsPaths(fs).sort()).toStrictEqual(expected);
  });
});