import { StepManager } from 'boilersmith/step-manager';
import { FlarumProviders } from '../../../providers';
import { genExtScaffolder } from '../../../steps/gen-ext-scaffolder';
import BaseCommand from '../../../base-command';
import { GenerateJobStub } from '../../../steps/stubs/backend/job';

export default class Job extends BaseCommand {
  static description = 'Generate a job class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager.step(new GenerateJobStub(this.STUB_PATH, genExtScaffolder()));
  }
}
