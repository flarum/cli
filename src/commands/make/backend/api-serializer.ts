import { StepManager } from 'boilersmith/step-manager';
import { FlarumProviders } from 'src/providers';
import { genExtScaffolder } from 'src/steps/gen-ext-scaffolder';
import BaseCommand from '../../../base-command';
import { GenerateApiSerializerStub } from '../../../steps/stubs/backend/api-serializer';

export default class ApiSerializer extends BaseCommand {
  static description = 'Generate an API serializer class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager.step(new GenerateApiSerializerStub(this.STUB_PATH, genExtScaffolder()));
  }
}
