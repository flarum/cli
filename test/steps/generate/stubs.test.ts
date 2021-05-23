import { getFsPaths, runStep } from '../../utils';

import { GenerateEventListener } from '../../../src/steps/stubs/backend/event-listener';
import { PathProvider } from '../../../src/provider/path-provider';

interface StubTest {
  stubClass: any;

  params: Record<string, unknown>;

  expectedModifiedFilesDefaultDir: string[];

  expectedModifiedFilesRequestedDir: string[];

  expectedExposedParamsDefaultDir: Record<string, unknown>;

  expectedExposedParamsRequestedDir: Record<string, unknown>;
}

const requestedDir = '/ext/src/somePath';

const testSpecs: StubTest[] = [
  // Event Listener
  {
    stubClass: GenerateEventListener,
    params: {
      className: 'MutateDatabaseSave',
      eventClass: '\\Flarum\\Post\\Event\\Saving',
    },
    expectedModifiedFilesDefaultDir: [
      '/ext/src/Listener/MutateDatabaseSave.php',
    ],
    expectedModifiedFilesRequestedDir: [
      `${requestedDir}/MutateDatabaseSave.php`,
    ],
    expectedExposedParamsDefaultDir: {
      class: 'Flarum\\Demo\\Listener\\MutateDatabaseSave',
      eventClass: '\\Flarum\\Post\\Event\\Saving',
    },
    expectedExposedParamsRequestedDir: {
      class: 'Flarum\\Demo\\somePath\\MutateDatabaseSave',
      eventClass: '\\Flarum\\Post\\Event\\Saving',
    },
  },
];

const sampleComposerJson = {
  name: 'flarum/test',
  autoload: {
    'psr-4': {
      'Flarum\\Demo\\': 'src/',
    },
  },
};

describe('Stub tests', function () {
  testSpecs.forEach(spec => {
    describe(`Stub Test: ${spec.stubClass.name}`, function () {
      const initialFilesCallback = (pathProvider: PathProvider) => {
        const initial: Record<string, string> = {};
        initial[pathProvider.ext('composer.json')] = JSON.stringify(sampleComposerJson);
        return initial;
      };

      test('With default dir', async function () {
        const { fs, exposedParams } = await runStep(spec.stubClass, Object.values(spec.params), {}, initialFilesCallback);

        expect(getFsPaths(fs)).toStrictEqual([...spec.expectedModifiedFilesDefaultDir, '/ext/composer.json'].sort());

        expect(exposedParams).toStrictEqual(spec.expectedExposedParamsDefaultDir);
      });

      test('With requested dir', async function () {
        const { fs, exposedParams } = await runStep(spec.stubClass, Object.values(spec.params), {}, initialFilesCallback, requestedDir);

        expect(getFsPaths(fs)).toStrictEqual([...spec.expectedModifiedFilesRequestedDir, '/ext/composer.json'].sort());

        expect(exposedParams).toStrictEqual(spec.expectedExposedParamsRequestedDir);
      });
    });
  });
});
