import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateModelStub } from '../../../steps/stubs/frontend/model';
import { GenerateModelDefinition } from '../../../steps/js/model';

export default class Model extends BaseCommand {
  static description = 'Generate a model class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .atomicGroup(stepManager => {
        stepManager
          .namedStep('model', new GenerateModelStub())
          .step(new GenerateModelDefinition(), {}, [
            {
              sourceStep: 'model',
              exposedName: 'frontend',
            },
            {
              sourceStep: 'model',
              exposedName: 'className',
            },
            {
              sourceStep: 'model',
              exposedName: 'classNamespace',
            },
            {
              sourceStep: 'model',
              exposedName: 'modelType',
            },
          ]);
      });
  }
}
