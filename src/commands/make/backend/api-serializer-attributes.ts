import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateApiSerializerAttributesExtender } from '../../../steps/extenders/api-serializer';

export default class ApiSerializerAttribute extends BaseCommand {
  static description = 'Generate an API serializer attributes extender';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .step(new GenerateApiSerializerAttributesExtender());
  }
}
