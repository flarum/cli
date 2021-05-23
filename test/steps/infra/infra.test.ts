import { getExtFileContents, getFsPaths, runStep } from '../../utils';
import { BackendTestingInfra } from '../../../src/steps/infra/backend-testing';
import get from 'just-safe-get';
import { resolve } from 'path';
import { PathProvider } from '../../../src/provider/path-provider';

interface InfraTest {
  infraClass: any;

  initialJson: Record<string, string>;

  expectedJsonEntries: Record<string, Record<string, string>>;
}

const initialComposerJson = JSON.stringify({
  name: 'flarum/demo',
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
  testSpecs.forEach(spec => {
    const InfraClass = spec.infraClass;

    test(`Touches proper files: ${InfraClass.name}`, async function () {
      const instance = new InfraClass();
      const { fs } = await runStep(InfraClass);

      const expected = [
        ...instance.filesToReplace,
        ...Object.keys(instance.jsonToAugment),
      ].map(path => resolve('/ext', path)).sort();

      expect(getFsPaths(fs)).toStrictEqual(expected);
    });

    test(`Coincides with expected JSON content: ${spec}`, async function () {
      const initialFilesCallback = (pathProvider: PathProvider) => {
        const initialFiles: any = {};

        Object.keys(spec.initialJson).forEach(path => {
          initialFiles[pathProvider.ext(path)] = spec.initialJson[path];
        });

        return initialFiles;
      };

      const { fs } = await runStep(InfraClass, [], {}, initialFilesCallback);

      Object.keys(spec.expectedJsonEntries).forEach(filePath => {
        const expectedEntries = spec.expectedJsonEntries[filePath];
        const newJson = JSON.parse(getExtFileContents(fs, filePath));

        Object.keys(expectedEntries).forEach(key => {
          expect(get(newJson, key)).toStrictEqual(expectedEntries[key]);
        });
      });
    });
  });
});
