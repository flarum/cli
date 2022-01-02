import { StepManager } from 'boilersmith/step-manager';
import { FlarumProviders } from 'src/providers';
import BaseCommand from '../../../base-command';
import { GenerateRoutesExtender } from '../../../steps/extenders/route';

export default class Route extends BaseCommand {
  static description = 'Generate a routes extender';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager
      .step(new GenerateRoutesExtender());
  }
}
