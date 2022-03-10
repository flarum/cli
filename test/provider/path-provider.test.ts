import path from 'path';
import { NodePaths } from 'boilersmith/paths';

describe('NodePaths Works', function () {
  test('Returns paths as expected', async function () {
    const provider = new NodePaths({
      package: '/',
      requestedDir: '/tmp',
    });

    expect(provider.cwd('file.php')).toStrictEqual(path.resolve(process.cwd(), 'file.php'));
    expect(provider.package('composer/composer.json')).toStrictEqual('/composer/composer.json');
    expect(provider.requestedDir('file2.php')).toStrictEqual('/tmp/file2.php');
  });

  test('Returns null if requestedDir not provided', async function () {
    const provider = new NodePaths({
      package: '/',
    });

    expect(provider.requestedDir('file.php')).toBe(null);
  });
});
