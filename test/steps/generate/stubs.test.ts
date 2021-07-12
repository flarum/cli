import { getFsPaths, runStep } from '../../utils';

import { GenerateEventListenerStub } from '../../../src/steps/stubs/backend/event-listener';
import { GenerateApiControllerStub } from '../../../src/steps/stubs/backend/api-controller';
import { GenerateApiSerializerStub } from '../../../src/steps/stubs/backend/api-serializer';
import { GenerateIntegrationTestStub } from '../../../src/steps/stubs/backend/integration-test';
import { GenerateMigrationStub } from '../../../src/steps/stubs/backend/migration';
import { GenerateModelStub } from '../../../src/steps/stubs/backend/model';
import { GenerateServiceProviderStub } from '../../../src/steps/stubs/backend/service-provider';
import { GenerateJobStub } from '../../../src/steps/stubs/backend/job';
import { GenerateRepositoryStub } from '../../../src/steps/stubs/backend/repository';
import { GenerateValidatorStub } from '../../../src/steps/stubs/backend/validator';
import { GeneratePolicyStub } from '../../../src/steps/stubs/backend/policy';
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
const requestedTestDir = '/ext/tests/somePath';

const testSpecs: StubTest[] = [
  // Event Listener
  {
    stubClass: GenerateEventListenerStub,
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

  // Api Serializer
  {
    stubClass: GenerateApiSerializerStub,
    params: {
      className: 'PotatoSerializer',
      modelClass: '\\Flarum\\Potato\\Potato',
    },
    expectedModifiedFilesDefaultDir: [
      '/ext/src/Api/Serializer/PotatoSerializer.php',
    ],
    expectedModifiedFilesRequestedDir: [
      `${requestedDir}/PotatoSerializer.php`,
    ],
    expectedExposedParamsDefaultDir: {
      class: 'Flarum\\Demo\\Api\\Serializer\\PotatoSerializer',
      modelClass: '\\Flarum\\Potato\\Potato',
      modelClassName: 'Potato',
    },
    expectedExposedParamsRequestedDir: {
      class: 'Flarum\\Demo\\somePath\\PotatoSerializer',
      modelClass: '\\Flarum\\Potato\\Potato',
      modelClassName: 'Potato',
    },
  },

  // Model
  {
    stubClass: GenerateModelStub,
    params: {
      className: 'CustomModel',
      tableName: 'custom_models',
    },
    expectedModifiedFilesDefaultDir: [
      '/ext/src/CustomModel.php',
    ],
    expectedModifiedFilesRequestedDir: [
      `${requestedDir}/CustomModel.php`,
    ],
    expectedExposedParamsDefaultDir: {
      class: 'Flarum\\Demo\\CustomModel',
      className: 'CustomModel',
      migrationName: 'create_custom_models_table',
    },
    expectedExposedParamsRequestedDir: {
      class: 'Flarum\\Demo\\somePath\\CustomModel',
      className: 'CustomModel',
      migrationName: 'create_custom_models_table',
    },
  },

  // Repository
  {
    stubClass: GenerateRepositoryStub,
    params: {
      className: 'CustomModelRepository',
      modelClass: 'Flarum\\CustomModel\\CustomModel',
    },
    expectedModifiedFilesDefaultDir: [
      '/ext/src/CustomModelRepository.php',
    ],
    expectedModifiedFilesRequestedDir: [
      `${requestedDir}/CustomModelRepository.php`,
    ],
    expectedExposedParamsDefaultDir: {
      class: 'Flarum\\Demo\\CustomModelRepository',
      modelClass: 'Flarum\\CustomModel\\CustomModel',
      modelClassName: 'CustomModel',
    },
    expectedExposedParamsRequestedDir: {
      class: 'Flarum\\Demo\\somePath\\CustomModelRepository',
      modelClass: 'Flarum\\CustomModel\\CustomModel',
      modelClassName: 'CustomModel',
    },
  },

  // Validator
  {
    stubClass: GenerateValidatorStub,
    params: {
      className: 'CustomModelValidator',
    },
    expectedModifiedFilesDefaultDir: [
      '/ext/src/CustomModelValidator.php',
    ],
    expectedModifiedFilesRequestedDir: [
      `${requestedDir}/CustomModelValidator.php`,
    ],
    expectedExposedParamsDefaultDir: {
      class: 'Flarum\\Demo\\CustomModelValidator',
    },
    expectedExposedParamsRequestedDir: {
      class: 'Flarum\\Demo\\somePath\\CustomModelValidator',
    },
  },

  // Policy
  {
    stubClass: GeneratePolicyStub,
    params: {
      className: 'CustomModelPolicy',
      modelClass: 'Flarum\\CustomModel\\CustomModel',
    },
    expectedModifiedFilesDefaultDir: [
      '/ext/src/Access/CustomModelPolicy.php',
    ],
    expectedModifiedFilesRequestedDir: [
      `${requestedDir}/CustomModelPolicy.php`,
    ],
    expectedExposedParamsDefaultDir: {
      class: 'Flarum\\Demo\\Access\\CustomModelPolicy',
      modelClass: 'Flarum\\CustomModel\\CustomModel',
      modelClassName: 'CustomModel',
    },
    expectedExposedParamsRequestedDir: {
      class: 'Flarum\\Demo\\somePath\\CustomModelPolicy',
      modelClass: 'Flarum\\CustomModel\\CustomModel',
      modelClassName: 'CustomModel',
    },
  },

  // Service Provider
  {
    stubClass: GenerateServiceProviderStub,
    params: {
      className: 'CustomServiceProvider',
    },
    expectedModifiedFilesDefaultDir: [
      '/ext/src/CustomServiceProvider.php',
    ],
    expectedModifiedFilesRequestedDir: [
      `${requestedDir}/CustomServiceProvider.php`,
    ],
    expectedExposedParamsDefaultDir: {
      class: 'Flarum\\Demo\\CustomServiceProvider',
    },
    expectedExposedParamsRequestedDir: {
      class: 'Flarum\\Demo\\somePath\\CustomServiceProvider',
    },
  },

  // Job
  {
    stubClass: GenerateJobStub,
    params: {
      className: 'CustomJob',
    },
    expectedModifiedFilesDefaultDir: [
      '/ext/src/Job/CustomJob.php',
    ],
    expectedModifiedFilesRequestedDir: [
      `${requestedDir}/CustomJob.php`,
    ],
    expectedExposedParamsDefaultDir: {
      class: 'Flarum\\Demo\\Job\\CustomJob',
    },
    expectedExposedParamsRequestedDir: {
      class: 'Flarum\\Demo\\somePath\\CustomJob',
    },
  },

  // Integration Test
  {
    stubClass: GenerateIntegrationTestStub,
    params: {
      className: 'ListPotatoesTest',
    },
    expectedModifiedFilesDefaultDir: [
      '/ext/tests/integration/api/ListPotatoesTest.php',
    ],
    expectedModifiedFilesRequestedDir: [
      `${requestedTestDir}/ListPotatoesTest.php`,
    ],
    expectedExposedParamsDefaultDir: {
      class: 'Flarum\\Demo\\tests\\integration\\api\\ListPotatoesTest',
    },
    expectedExposedParamsRequestedDir: {
      class: 'Flarum\\Demo\\tests\\somePath\\ListPotatoesTest',
    },
  },
];

// Api Controllers
['normal', 'list', 'show', 'create', 'update', 'delete'].forEach(classType => {
  testSpecs.push({
    stubClass: GenerateApiControllerStub,
    params: {
      className: `${classType}Controller`,
      serializerClass: `Flarum\\Demo\\Custom${classType}Serializer`,
      handlerCommandClass: `Flarum\\Demo\\Custom${classType}`,
      classType,
    },
    expectedModifiedFilesDefaultDir: [
      `/ext/src/Api/Controller/${classType}Controller.php`,
    ],
    expectedModifiedFilesRequestedDir: [
      `${requestedDir}/${classType}Controller.php`,
    ],
    expectedExposedParamsDefaultDir: {
      class: `Flarum\\Demo\\Api\\Controller\\${classType}Controller`,
    },
    expectedExposedParamsRequestedDir: {
      class: `Flarum\\Demo\\somePath\\${classType}Controller`,
    },
  });
});

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

const migrationSpec = {
  stubClass: GenerateMigrationStub,
  params: {
    name: 'new migration',
  },
  expectedModifiedFilesDefaultDir: [
    '/ext/migrations/2020_01_01_000000_new_migration.php',
  ],
  expectedModifiedFilesRequestedDir: [
    '/ext/migrations/2020_01_01_000000_new_migration.php',
  ],
  expectedExposedParamsDefaultDir: {},
  expectedExposedParamsRequestedDir: {},
};

describe('Stub Test: Migrations', function () {
  jest
    .useFakeTimers('modern')
    .setSystemTime(new Date('2020-01-01T03:24:00').getTime());

  const initialFilesCallback = (pathProvider: PathProvider) => {
    const initial: Record<string, string> = {};
    initial[pathProvider.ext('composer.json')] = JSON.stringify(sampleComposerJson);
    return initial;
  };

  test('With default dir', async function () {
    const { fs, exposedParams } = await runStep(migrationSpec.stubClass, Object.values(migrationSpec.params), {}, initialFilesCallback);

    expect(getFsPaths(fs)).toStrictEqual([...migrationSpec.expectedModifiedFilesDefaultDir, '/ext/composer.json'].sort());

    expect(exposedParams).toStrictEqual(migrationSpec.expectedExposedParamsDefaultDir);
  });

  test('With requested dir', async function () {
    const { fs, exposedParams } = await runStep(migrationSpec.stubClass, Object.values(migrationSpec.params), {}, initialFilesCallback, requestedDir);

    expect(getFsPaths(fs)).toStrictEqual([...migrationSpec.expectedModifiedFilesRequestedDir, '/ext/composer.json'].sort());

    expect(exposedParams).toStrictEqual(migrationSpec.expectedExposedParamsRequestedDir);
  });
});
