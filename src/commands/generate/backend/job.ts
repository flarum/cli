import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateJobStub } from '../../../steps/stubs/backend/job';

export default class ServiceProvider extends BaseCommand {
  static description = 'Generate a job class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager.step(new GenerateJobStub());
  }
}
