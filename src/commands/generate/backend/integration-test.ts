import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateIntegrationTestStub } from '../../../steps/stubs/backend/integration-test';

export default class IntegrationTest extends BaseCommand {
  static description = 'generate an integration test class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .atomicGroup(stepManager => {
        stepManager
          .namedStep('test', new GenerateIntegrationTestStub());
      });
  }
}
