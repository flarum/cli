import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateRouteExtender } from '../../../steps/extenders/route';

export default class Route extends BaseCommand {
  static description = 'generate an API serializer attributes extender';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .step(new GenerateRouteExtender());
  }
}
