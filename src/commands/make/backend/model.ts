/* eslint-disable no-warning-comments */
import pluralize from 'pluralize';
import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateModelStub } from '../../../steps/stubs/backend/model';
import { GenerateMigrationStub } from '../../../steps/stubs/backend/migration';
import { GenerateApiSerializerStub } from '../../../steps/stubs/backend/api-serializer';
import { GenerateValidatorStub } from '../../../steps/stubs/backend/validator';
import { GenerateRepositoryStub } from '../../../steps/stubs/backend/repository';
import { GeneratePolicyStub } from '../../../steps/stubs/backend/policy';
import { GeneratePolicyExtender } from '../../../steps/extenders/policy';
import { GenerateApiControllerStub } from '../../../steps/stubs/backend/api-controller';
import { GenerateHandlerStub } from '../../../steps/stubs/backend/handler';
import { GenerateHandlerCommandStub } from '../../../steps/stubs/backend/handler-command';
import { GenerateRoutesExtender } from '../../../steps/extenders/route';
import { FlarumProviders } from 'src/providers';
import { genExtScaffolder } from 'src/steps/gen-ext-scaffolder';

export default class Model extends BaseCommand {
  static description = 'Generate a model class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager
      .atomicGroup(stepManager => {
        stepManager
          .namedStep('model', new GenerateModelStub(this.STUB_PATH, genExtScaffolder()))
          .step(new GenerateMigrationStub(this.STUB_PATH, genExtScaffolder()), { optional: true, confirmationMessage: 'Generate corresponding Migration?', default: true }, [
            {
              sourceStep: 'model',
              exposedName: 'migrationName',
              consumedName: 'name',
            },
          ])
          .namedStep('serializer', new GenerateApiSerializerStub(this.STUB_PATH, genExtScaffolder()), { optional: true, confirmationMessage: 'Generate corresponding API Serializer?', default: true }, [
            {
              sourceStep: 'model',
              exposedName: 'class',
              consumedName: 'modelClass',
            },
            {
              sourceStep: 'model',
              exposedName: 'className',
              consumedName: 'className',
              modifier: (modelClassName: unknown) => `${modelClassName as string}Serializer`,
            },
          ])
          .namedStep('validator', new GenerateValidatorStub(this.STUB_PATH, genExtScaffolder()), { optional: true, confirmationMessage: 'Generate corresponding Validator?', default: true }, [
            {
              sourceStep: 'model',
              exposedName: 'className',
              consumedName: 'className',
              modifier: (modelClassName: unknown) => `${modelClassName as string}Validator`,
            },
          ])
          .namedStep('repository', new GenerateRepositoryStub(this.STUB_PATH, genExtScaffolder()), { optional: true, confirmationMessage: 'Generate corresponding Repository?', default: true }, [
            {
              sourceStep: 'model',
              exposedName: 'class',
              consumedName: 'modelClass',
            },
            {
              sourceStep: 'model',
              exposedName: 'className',
              consumedName: 'className',
              modifier: (modelClassName: unknown) => `${modelClassName as string}Repository`,
            },
          ])
          .namedStep('policy', new GeneratePolicyStub(this.STUB_PATH, genExtScaffolder()), { optional: true, confirmationMessage: 'Generate corresponding Policy?', default: true }, [
            {
              sourceStep: 'model',
              exposedName: 'class',
              consumedName: 'modelClass',
            },
            {
              sourceStep: 'model',
              exposedName: 'className',
              consumedName: 'className',
              modifier: (modelClassName: unknown) => `${modelClassName as string}Policy`,
            },
          ])
          .step(new GeneratePolicyExtender(), {}, [
            {
              sourceStep: 'policy',
              exposedName: '__succeeded',
            },
            {
              sourceStep: 'policy',
              exposedName: 'class',
              consumedName: 'policyClass',
            },
            {
              sourceStep: 'policy',
              exposedName: 'modelClass',
            },
          ]);

        // Domain Handler Commands
        stepManager
          .namedStep(
            'createHandlerCommand',
            new GenerateHandlerCommandStub(this.STUB_PATH, genExtScaffolder()),
            { optional: true, confirmationMessage: 'Generate corresponding Domain Handlers?', default: true },
            [
              {
                sourceStep: 'model',
                exposedName: 'className',
                modifier: (modelClassName: unknown) => `Create${modelClassName as string}`,
              },
            ],
            {
              classType: 'create',
            },
          )
          .namedStep(
            'updateHandlerCommand',
            new GenerateHandlerCommandStub(this.STUB_PATH, genExtScaffolder()),
            {},
            [
              {
                sourceStep: 'createHandlerCommand',
                exposedName: '__succeeded',
              },
              {
                sourceStep: 'model',
                exposedName: 'className',
                modifier: (modelClassName: unknown) => `Edit${modelClassName as string}`,
              },
            ],
            {
              classType: 'update',
            },
          )
          .namedStep(
            'deleteHandlerCommand',
            new GenerateHandlerCommandStub(this.STUB_PATH, genExtScaffolder()),
            {},
            [
              {
                sourceStep: 'createHandlerCommand',
                exposedName: '__succeeded',
              },
              {
                sourceStep: 'model',
                exposedName: 'className',
                modifier: (modelClassName: unknown) => `Delete${modelClassName as string}`,
              },
            ],
            {
              classType: 'delete',
            },
          );

        // Domain Handlers
        stepManager
          .step(new GenerateHandlerStub(this.STUB_PATH, genExtScaffolder()), {}, [
            {
              sourceStep: 'createHandlerCommand',
              exposedName: '__succeeded',
            },
            {
              sourceStep: 'createHandlerCommand',
              exposedName: 'className',
              modifier: (className: unknown) => `${className as string}Handler`,
            },
            {
              sourceStep: 'createHandlerCommand',
              exposedName: 'className',
              consumedName: 'handlerCommandClass',
            },
            {
              sourceStep: 'repository',
              exposedName: 'class',
              consumedName: 'repositoryClass',
            },
            {
              sourceStep: 'validator',
              exposedName: 'class',
              consumedName: 'validatorClass',
            },
            {
              sourceStep: 'createHandlerCommand',
              exposedName: 'classType',
            },
          ])
          .step(new GenerateHandlerStub(this.STUB_PATH, genExtScaffolder()), {}, [
            {
              sourceStep: 'updateHandlerCommand',
              exposedName: '__succeeded',
            },
            {
              sourceStep: 'updateHandlerCommand',
              exposedName: 'className',
              modifier: (className: unknown) => `${className as string}Handler`,
            },
            {
              sourceStep: 'updateHandlerCommand',
              exposedName: 'className',
              consumedName: 'handlerCommandClass',
            },
            {
              sourceStep: 'repository',
              exposedName: 'class',
              consumedName: 'repositoryClass',
            },
            {
              sourceStep: 'validator',
              exposedName: 'class',
              consumedName: 'validatorClass',
            },
            {
              sourceStep: 'updateHandlerCommand',
              exposedName: 'classType',
            },
          ])
          .step(new GenerateHandlerStub(this.STUB_PATH, genExtScaffolder()), {}, [
            {
              sourceStep: 'deleteHandlerCommand',
              exposedName: '__succeeded',
            },
            {
              sourceStep: 'deleteHandlerCommand',
              exposedName: 'className',
              modifier: (className: unknown) => `${className as string}Handler`,
            },
            {
              sourceStep: 'deleteHandlerCommand',
              exposedName: 'className',
              consumedName: 'handlerCommandClass',
            },
            {
              sourceStep: 'repository',
              exposedName: 'class',
              consumedName: 'repositoryClass',
            },
            {
              sourceStep: 'deleteHandlerCommand',
              exposedName: 'classType',
            },
          ], {
            validatorClass: '', // TODO: This type of parameter is a bit of a mess
          });

        // API Controllers
        stepManager
          .namedStep(
            'listApiController',
            new GenerateApiControllerStub(this.STUB_PATH, genExtScaffolder()),
            { optional: true, confirmationMessage: 'Generate corresponding CRUD API Controllers?', default: true },
            [
              {
                sourceStep: 'model',
                exposedName: 'className',
                consumedName: 'className',
                modifier: (modelClassName: unknown) => {
                  const pluralModelClassName = pluralize(modelClassName as string);

                  return `List${pluralModelClassName}Controller`;
                },
              },
              {
                sourceStep: 'serializer',
                exposedName: 'class',
                consumedName: 'serializerClass',
              },
            ],
            {
              classType: 'list',
              handlerCommandClass: '',
            },
          )
          .namedStep(
            'showApiController',
            new GenerateApiControllerStub(this.STUB_PATH, genExtScaffolder()),
            {},
            [
              {
                sourceStep: 'listApiController',
                exposedName: '__succeeded',
              },
              {
                sourceStep: 'model',
                exposedName: 'className',
                consumedName: 'className',
                modifier: (modelClassName: unknown) => `Show${modelClassName as string}Controller`,
              },
              {
                sourceStep: 'serializer',
                exposedName: 'class',
                consumedName: 'serializerClass',
              },
            ],
            {
              classType: 'show',
              handlerCommandClass: '',
            },
          )
          .namedStep(
            'createApiController',
            new GenerateApiControllerStub(this.STUB_PATH, genExtScaffolder()),
            {},
            [
              {
                sourceStep: 'listApiController',
                exposedName: '__succeeded',
              },
              {
                sourceStep: 'model',
                exposedName: 'className',
                consumedName: 'className',
                modifier: (modelClassName: unknown) => `Create${modelClassName as string}Controller`,
              },
              {
                sourceStep: 'serializer',
                exposedName: 'class',
                consumedName: 'serializerClass',
              },
              {
                sourceStep: 'createHandlerCommand',
                exposedName: 'class',
                consumedName: 'handlerCommandClass',
              },
            ],
            {
              classType: 'create',
            },
          )
          .namedStep(
            'updateApiController',
            new GenerateApiControllerStub(this.STUB_PATH, genExtScaffolder()),
            {},
            [
              {
                sourceStep: 'listApiController',
                exposedName: '__succeeded',
              },
              {
                sourceStep: 'model',
                exposedName: 'className',
                consumedName: 'className',
                modifier: (modelClassName: unknown) => `Update${modelClassName as string}Controller`,
              },
              {
                sourceStep: 'serializer',
                exposedName: 'class',
                consumedName: 'serializerClass',
              },
              {
                sourceStep: 'updateHandlerCommand',
                exposedName: 'class',
                consumedName: 'handlerCommandClass',
              },
            ],
            {
              classType: 'update',
            },
          )
          .namedStep(
            'deleteApiController',
            new GenerateApiControllerStub(this.STUB_PATH, genExtScaffolder()),
            {},
            [
              {
                sourceStep: 'listApiController',
                exposedName: '__succeeded',
              },
              {
                sourceStep: 'model',
                exposedName: 'className',
                consumedName: 'className',
                modifier: (modelClassName: unknown) => `Delete${modelClassName as string}Controller`,
              },
              {
                sourceStep: 'serializer',
                exposedName: 'class',
                consumedName: 'serializerClass',
              },
              {
                sourceStep: 'deleteHandlerCommand',
                exposedName: 'class',
                consumedName: 'handlerCommandClass',
              },
            ],
            {
              classType: 'delete',
            },
          )
          // Routes
          .namedStep(
            'listRoute',
            new GenerateRoutesExtender(),
            { optional: true, confirmationMessage: 'Generate corresponding API Routes?', default: true },
            [
              {
                sourceStep: 'model',
                exposedName: 'modelPluralKebab',
                consumedName: 'routePath',
                modifier: (value: unknown) => `/${value}`,
              },
              {
                sourceStep: 'model',
                exposedName: 'modelPluralKebab',
                consumedName: 'routeName',
                modifier: (value: unknown) => `${value}.index`,
              },
              {
                sourceStep: 'listApiController',
                exposedName: 'class',
                consumedName: 'routeHandler',
              },
            ],
            {
              httpMethod: 'get',
            },
          )
          .step(
            new GenerateRoutesExtender(),
            {},
            [
              {
                sourceStep: 'listRoute',
                exposedName: '__succeeded',
              },
              {
                sourceStep: 'model',
                exposedName: 'modelPluralKebab',
                consumedName: 'routePath',
                modifier: (value: unknown) => `/${value}/{id}`,
              },
              {
                sourceStep: 'model',
                exposedName: 'modelPluralKebab',
                consumedName: 'routeName',
                modifier: (value: unknown) => `${value}.show`,
              },
              {
                sourceStep: 'showApiController',
                exposedName: 'class',
                consumedName: 'routeHandler',
              },
            ],
            {
              httpMethod: 'get',
            },
          )
          .step(
            new GenerateRoutesExtender(),
            {},
            [
              {
                sourceStep: 'listRoute',
                exposedName: '__succeeded',
              },
              {
                sourceStep: 'model',
                exposedName: 'modelPluralKebab',
                consumedName: 'routePath',
                modifier: (value: unknown) => `/${value}`,
              },
              {
                sourceStep: 'model',
                exposedName: 'modelPluralKebab',
                consumedName: 'routeName',
                modifier: (value: unknown) => `${value}.create`,
              },
              {
                sourceStep: 'createApiController',
                exposedName: 'class',
                consumedName: 'routeHandler',
              },
            ],
            {
              httpMethod: 'post',
            },
          )
          .step(
            new GenerateRoutesExtender(),
            {},
            [
              {
                sourceStep: 'listRoute',
                exposedName: '__succeeded',
              },
              {
                sourceStep: 'model',
                exposedName: 'modelPluralKebab',
                consumedName: 'routePath',
                modifier: (value: unknown) => `/${value}/{id}`,
              },
              {
                sourceStep: 'model',
                exposedName: 'modelPluralKebab',
                consumedName: 'routeName',
                modifier: (value: unknown) => `${value}.update`,
              },
              {
                sourceStep: 'updateApiController',
                exposedName: 'class',
                consumedName: 'routeHandler',
              },
            ],
            {
              httpMethod: 'patch',
            },
          )
          .step(
            new GenerateRoutesExtender(),
            {},
            [
              {
                sourceStep: 'listRoute',
                exposedName: '__succeeded',
              },
              {
                sourceStep: 'model',
                exposedName: 'modelPluralKebab',
                consumedName: 'routePath',
                modifier: (value: unknown) => `/${value}/{id}`,
              },
              {
                sourceStep: 'model',
                exposedName: 'modelPluralKebab',
                consumedName: 'routeName',
                modifier: (value: unknown) => `${value}.delete`,
              },
              {
                sourceStep: 'deleteApiController',
                exposedName: 'class',
                consumedName: 'routeHandler',
              },
            ],
            {
              httpMethod: 'delete',
            },
          );
      });
  }
}
