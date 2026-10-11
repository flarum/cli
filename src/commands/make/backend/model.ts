import { PredefinedParameters, ShouldRunConfig, StepDependency, StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateModelStub } from '../../../steps/stubs/backend/model';
import { GenerateModelFactoryStub } from '../../../steps/stubs/backend/model-factory';
import { GenerateMigrationStub } from '../../../steps/stubs/backend/migration';
import { GenerateApiResourceStub } from '../../../steps/stubs/backend/api-resource';
import { GeneratePolicyStub } from '../../../steps/stubs/backend/policy';
import { GeneratePolicyExtender } from '../../../steps/extenders/policy';
import { FlarumProviders } from '../../../providers';
import { genExtScaffolder } from '../../../steps/gen-ext-scaffolder';
import { GenerateApiResourceExtender } from '../../../steps/extenders/api-resource';
import * as Interfaces from '@oclif/core/lib/interfaces';

export default class BackendModel extends BaseCommand {
  static description = 'Generate a model class';

  static flags = { ...BaseCommand.flags };

  static args: Interfaces.ArgInput = [BaseCommand.classNameArg, ...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager.atomicGroup((stepManager) => {
      BackendModel.steps(stepManager, this.STUB_PATH);
    });
  }

  public static steps(
    stepManager: StepManager<FlarumProviders>,
    STUB_PATH: string,
    shouldRun?: ShouldRunConfig,
    dependencies?: StepDependency[],
    predefinedDependencies?: PredefinedParameters
  ): StepManager<FlarumProviders> {
    // The factory is not optional: the model uses HasFactory, which needs it.
    return stepManager
      .namedStep('backendModel', new GenerateModelStub(STUB_PATH, genExtScaffolder()), shouldRun, dependencies, predefinedDependencies)
      .step(new GenerateModelFactoryStub(STUB_PATH, genExtScaffolder()), {}, [
        {
          sourceStep: 'backendModel',
          exposedName: 'className',
          consumedName: 'className',
          modifier: (modelClassName: unknown) => `${modelClassName as string}Factory`,
        },
      ])
      .step(
        new GenerateMigrationStub(STUB_PATH, genExtScaffolder()),
        { optional: true, confirmationMessage: 'Generate corresponding Migration?', default: true },
        [
          {
            sourceStep: 'backendModel',
            exposedName: 'migrationName',
            consumedName: 'name',
          },
        ]
      )
      .namedStep(
        'api-resource',
        new GenerateApiResourceStub(STUB_PATH, genExtScaffolder()),
        { optional: true, confirmationMessage: 'Generate corresponding API Resource?', default: true },
        [
          {
            sourceStep: 'backendModel',
            exposedName: 'class',
            consumedName: 'modelClass',
          },
          {
            sourceStep: 'backendModel',
            exposedName: 'className',
            consumedName: 'className',
            modifier: (modelClassName: unknown) => `${modelClassName as string}Resource`,
          },
        ]
      )
      .step(new GenerateApiResourceExtender(), {}, [
        {
          sourceStep: 'api-resource',
          exposedName: 'class',
          consumedName: 'resourceClass',
        },
      ])
      .namedStep(
        'policy',
        new GeneratePolicyStub(STUB_PATH, genExtScaffolder()),
        { optional: true, confirmationMessage: 'Generate corresponding Policy?', default: true },
        [
          {
            sourceStep: 'backendModel',
            exposedName: 'class',
            consumedName: 'modelClass',
          },
          {
            sourceStep: 'backendModel',
            exposedName: 'className',
            consumedName: 'className',
            modifier: (modelClassName: unknown) => `${modelClassName as string}Policy`,
          },
        ]
      )
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
  }
}
