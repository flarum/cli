import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../../base-command';
import { GeneratePolicyStub } from '../../../steps/stubs/backend/policy';
import { GeneratePolicyExtender } from '../../../steps/extenders/policy';
import { FlarumProviders } from 'src/providers';
import { genExtScaffolder } from 'src/steps/gen-ext-scaffolder';

export default class Policy extends BaseCommand {
  static description = 'Generate a policy class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager
      .atomicGroup(stepManager => {
        stepManager
          .namedStep('policy', new GeneratePolicyStub(this.STUB_PATH, genExtScaffolder()))
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
