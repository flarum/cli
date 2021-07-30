import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateRepositoryStub } from '../../../steps/stubs/backend/repository';

export default class Repository extends BaseCommand {
  static description = 'Generate a repository class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager.step(new GenerateRepositoryStub());
  }
}
