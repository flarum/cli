import { StepManager } from 'boilersmith/step-manager';
import { FlarumProviders } from '../../../providers';
import { genExtScaffolder } from '../../../steps/gen-ext-scaffolder';
import BaseCommand from '../../../base-command';
import { GenerateComponentStub } from '../../../steps/stubs/frontend/component';

export default class Component extends BaseCommand {
  static description = 'Generate a frontend component';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager.step(new GenerateComponentStub(this.STUB_PATH, genExtScaffolder()));
  }
}
