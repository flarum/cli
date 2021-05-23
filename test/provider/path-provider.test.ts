import path from 'path';
import { PathFsProvider } from '../../src/provider/path-provider';

describe('PathFsProvider Works', function () {
  test('Returns paths as expected', async function () {
    const provider = new PathFsProvider({
      ext: '/',
      requestedDir: '/tmp',
    });

    expect(provider.cwd('file.php')).toStrictEqual(path.resolve(process.cwd(), 'file.php'));
    expect(provider.ext('composer/composer.json')).toStrictEqual('/composer/composer.json');
    expect(provider.boilerplate('stubs/model.js')).toStrictEqual(path.resolve(__dirname, '../../boilerplate', 'stubs/model.js'));
    expect(provider.requestedDir('file2.php')).toStrictEqual('/tmp/file2.php');
  });

  test('Returns null if requestedDir not provided', async function () {
    const provider = new PathFsProvider({
      ext: '/',
    });

    expect(provider.requestedDir('file.php')).toBe(null);
  });
});
