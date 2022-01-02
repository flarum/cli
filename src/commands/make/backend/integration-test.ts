import { StepManager } from 'boilersmith/step-manager';
import { FlarumProviders } from '../../../providers';
import { genExtScaffolder } from '../../../steps/gen-ext-scaffolder';
import BaseCommand from '../../../base-command';
import { GenerateIntegrationTestStub } from '../../../steps/stubs/backend/integration-test';

export default class IntegrationTest extends BaseCommand {
  static description = 'Generate an integration test class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager
      .atomicGroup(stepManager => {
        stepManager
          .namedStep('test', new GenerateIntegrationTestStub(this.STUB_PATH, genExtScaffolder()));
      });
  }
}
