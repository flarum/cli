import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateMigrationStub } from '../../../steps/stubs/backend/migration';
export default class Migration extends BaseCommand {
  static description = 'generate an event listener class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .step(new GenerateMigrationStub());
  }
}
