import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateModalStub } from '../../../steps/stubs/frontend/modal';

export default class Modal extends BaseCommand {
  static description = 'Generate a modal component';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager.step(new GenerateModalStub());
  }
}
