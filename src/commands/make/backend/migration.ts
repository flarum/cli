import { StepManager } from 'boilersmith/step-manager';
import { FlarumProviders } from 'src/providers';
import { genExtScaffolder } from 'src/steps/gen-ext-scaffolder';
import BaseCommand from '../../../base-command';
import { GenerateMigrationStub } from '../../../steps/stubs/backend/migration';

export default class Migration extends BaseCommand {
  static description = 'Generate a migration';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager
      .step(new GenerateMigrationStub(this.STUB_PATH, genExtScaffolder()));
  }
}
