import { getExtFileContents, getFsPaths, runStep } from '../../utils';
import { BackendTestingInfra } from '../../../src/steps/infra/backend-testing';
import { resolve } from 'path';
import { PathProvider } from '../../../src/provider/path-provider';

describe('Backend testing infra step', function () {
  test('Touches proper files', async function () {
    const fs = await runStep(BackendTestingInfra, {});

    const expected = [
      'tests/phpunit.integration.xml',
      'tests/phpunit.unit.xml',
      'tests/fixtures/.gitkeep',
      'tests/integration/setup.php',
      'tests/unit/.gitkeep',
      '.github/workflows/test.yml',
      'composer.json',
    ].map(path => resolve('/ext', path)).sort();

    expect(getFsPaths(fs)).toStrictEqual(expected);
    expect(getExtFileContents(fs, 'composer.json').includes('phpunit -c tests/phpunit.integration.xml')).toBe(true);
  });

  test('Doesnt mess up composer.json if already present', async function () {
    const fs = await runStep(BackendTestingInfra, {}, (pathProvider: PathProvider) => {
      const initialFiles: any = {};

      initialFiles[pathProvider.ext('composer.json')] = JSON.stringify({
        name: 'flarum/test',
        scripts: {
          'test:unit': 'should be overriden',
          somethingElse: 'should not be overriden',
        },
      });

      return initialFiles;
    });

    const newComposerJson = JSON.parse(getExtFileContents(fs, 'composer.json'));

    expect(newComposerJson.name).toStrictEqual('flarum/test');
    expect(newComposerJson.scripts['test:unit']).toStrictEqual('phpunit -c tests/phpunit.unit.xml');
    expect(newComposerJson.scripts.somethingElse).toStrictEqual('should not be overriden');
  });
});
