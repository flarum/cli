import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateApiSerializerStub } from '../../../steps/stubs/backend/api-serializer';

export default class ApiSerializer extends BaseCommand {
  static description = 'Generate an api serializer class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager.step(new GenerateApiSerializerStub());
  }
}
