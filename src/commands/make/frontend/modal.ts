import { StepManager } from 'boilersmith/step-manager';
import { FlarumProviders } from '../../../providers';
import { genExtScaffolder } from '../../../steps/gen-ext-scaffolder';
import BaseCommand from '../../../base-command';
import { GenerateModalStub } from '../../../steps/stubs/frontend/modal';

export default class Modal extends BaseCommand {
  static description = 'Generate a modal component';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager.step(new GenerateModalStub(this.STUB_PATH, genExtScaffolder()));
  }
}
