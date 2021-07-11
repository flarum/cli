import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateModelStub } from '../../../steps/stubs/backend/model';
import { GenerateMigrationStub } from '../../../steps/stubs/backend/migration';
import { GenerateApiSerializerStub } from '../../../steps/stubs/backend/api-serializer';
import { GenerateValidatorStub } from '../../../steps/stubs/backend/validator';
import { GenerateRepositoryStub } from '../../../steps/stubs/backend/repository';
import { GeneratePolicyStub } from '../../../steps/stubs/backend/policy';
import { GeneratePolicyExtender } from '../../../steps/extenders/policy';
import { GenerateApiControllerStub } from '../../../steps/stubs/backend/api-controller';

export default class Model extends BaseCommand {
  static description = 'Generate a model class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .atomicGroup(stepManager => {
        stepManager
          .namedStep('model', new GenerateModelStub())
          .step(new GenerateMigrationStub(), { optional: true, confirmationMessage: 'Generate corresponding migration?', default: true }, [
            {
              sourceStep: 'model',
              exposedName: 'migrationName',
              consumedName: 'name',
            },
          ])
          .step(new GenerateApiSerializerStub(), { optional: true, confirmationMessage: 'Generate corresponding API serializer?', default: true }, [
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
          .step(new GenerateValidatorStub(), { optional: true, confirmationMessage: 'Generate corresponding validator?', default: true }, [
            {
              sourceStep: 'model',
              exposedName: 'className',
              consumedName: 'className',
              modifier: (modelClassName: unknown) => `${modelClassName as string}Validator`,
            },
          ])
          .step(new GenerateRepositoryStub(), { optional: true, confirmationMessage: 'Generate corresponding repository?', default: true }, [
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
          .namedStep('policy', new GeneratePolicyStub(), { optional: true, confirmationMessage: 'Generate corresponding policy?', default: true }, [
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
          ])
          .namedStep('listApiController', new GenerateApiControllerStub(), { optional: true, confirmationMessage: 'Generate corresponding CRUD API controllers?', default: true }, [
            {
              sourceStep: 'model',
              exposedName: 'className',
              consumedName: 'className',
              modifier: (modelClassName: unknown) => `List${modelClassName as string}Controller`,
            },
          ], {
            classType: 'AbstractListController',
          })
          .step('showApiController', new GenerateApiControllerStub(), {}, [
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
          ], {
            classType: 'AbstractShowController',
          })
          .step('createApiController', new GenerateApiControllerStub(), {}, [
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
          ], {
            classType: 'AbstractCreateController',
          })
          .step('updateApiController', new GenerateApiControllerStub(), {}, [
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
          ], {
            classType: 'AbstractShowController',
          })
          .step('deleteApiController', new GenerateApiControllerStub(), {}, [
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
          ], {
            classType: 'AbstractDeleteController',
          });
      });
  }
}
