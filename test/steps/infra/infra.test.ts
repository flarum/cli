import { getExtFileContents, getFsPaths, runStep } from '../../boilersmith/utils';
import { BackendTestingInfra } from '../../../src/steps/infra/backend-testing';
import get from 'just-safe-get';
import { resolve } from 'node:path';
import { PathProvider } from 'boilersmith/path-provider';

interface InfraTest {
  infraClass: any;

  initialJson: Record<string, string>;

  expectedJsonEntries: Record<string, Record<string, string>>;
}

const initialComposerJson = JSON.stringify({
  name: 'flarum/demo',
  autoload: {
    'psr-4': {
      'Flarum\\Demo\\': 'src',
    },
  },
  scripts: {
    'test:unit': 'should be overriden',
    somethingElse: 'should not be overriden',
  },
});

const testSpecs: InfraTest[] = [
  // Backend testing
  {
    infraClass: BackendTestingInfra,

    initialJson: {
      'composer.json': initialComposerJson,
    },

    expectedJsonEntries: {
      'composer.json': {
        'scripts.test:integration': 'phpunit -c tests/phpunit.integration.xml',
        'scripts.somethingElse': 'should not be overriden',
        name: 'flarum/demo',
      },
    },
  },
];

describe('Infra testing', function () {
  for (const spec of testSpecs) {
    const InfraClass = spec.infraClass;

    test(`Touches proper files: ${InfraClass.name}`, async function () {
      const instance = new InfraClass();
      const { fs } = await runStep(instance);

      const expected = [
        ...instance.filesToReplace,
        ...Object.keys(instance.jsonToAugment),
      ].map(path => resolve('/ext', path)).sort();

      expect(getFsPaths(fs)).toStrictEqual(expected);
    });

    test(`Coincides with expected JSON content: ${spec}`, async function () {
      const initialFilesCallback = (pathProvider: PathProvider) => {
        const initialFiles: any = {};

        for (const path of Object.keys(spec.initialJson)) {
          initialFiles[pathProvider.ext(path)] = spec.initialJson[path];
        }

        return initialFiles;
      };

      const { fs } = await runStep(new InfraClass(), [], {}, initialFilesCallback);

      for (const filePath of Object.keys(spec.expectedJsonEntries)) {
        const expectedEntries = spec.expectedJsonEntries[filePath];
        const newJson = JSON.parse(getExtFileContents(fs, filePath));

        for (const key of Object.keys(expectedEntries)) {
          expect(get(newJson, key)).toStrictEqual(expectedEntries[key]);
        }
      }
    });
  }
});
