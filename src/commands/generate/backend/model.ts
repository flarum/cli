import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateModelStub } from '../../../steps/stubs/backend/model';
import { GenerateMigrationStub } from '../../../steps/stubs/backend/migration';

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
          ]);
      });
  }
}
