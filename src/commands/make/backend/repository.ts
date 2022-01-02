import { StepManager } from 'boilersmith/step-manager';
import { FlarumProviders } from 'src/providers';
import { genExtScaffolder } from 'src/steps/gen-ext-scaffolder';
import BaseCommand from '../../../base-command';
import { GenerateRepositoryStub } from '../../../steps/stubs/backend/repository';

export default class Repository extends BaseCommand {
  static description = 'Generate a repository class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager.step(new GenerateRepositoryStub(this.STUB_PATH, genExtScaffolder()));
  }
}
