import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateComponentStub } from '../../../steps/stubs/frontend/component';

export default class Component extends BaseCommand {
  static description = 'Generate a frontend component';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager.step(new GenerateComponentStub());
  }
}