import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateRoutesExtender } from '../../../steps/extenders/route';

export default class Route extends BaseCommand {
  static description = 'Generate a routes extender';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .step(new GenerateRoutesExtender());
  }
}
