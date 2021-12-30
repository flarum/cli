import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateValidatorStub } from '../../../steps/stubs/backend/validator';

export default class Validator extends BaseCommand {
  static description = 'Generate a validator class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager.step(new GenerateValidatorStub());
  }
}
