import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GeneratePolicyStub } from '../../../steps/stubs/backend/policy';
import { GeneratePolicyExtender } from '../../../steps/extenders/policy';

export default class Policy extends BaseCommand {
  static description = 'Generate a policy class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .atomicGroup(stepManager => {
        stepManager
          .namedStep('policy', new GeneratePolicyStub())
          .step(new GeneratePolicyExtender(), { optional: true, confirmationMessage: 'Generate corresponding extender?', default: true }, [
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
      });
  }
}
