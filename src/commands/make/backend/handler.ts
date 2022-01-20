import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateHandlerCommandStub } from '../../../steps/stubs/backend/handler-command';
import { GenerateHandlerStub } from '../../../steps/stubs/backend/handler';
import { FlarumProviders } from '../../../providers';
import { genExtScaffolder } from '../../../steps/gen-ext-scaffolder';

export default class ApiController extends BaseCommand {
  static description = 'Generate a domain logic handler class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager.atomicGroup((stepManager) => {
      stepManager.namedStep('handlerCommand', new GenerateHandlerCommandStub(this.STUB_PATH, genExtScaffolder())).step(
        new GenerateHandlerStub(this.STUB_PATH, genExtScaffolder()),
        {},
        [
          {
            sourceStep: 'handlerCommand',
            exposedName: 'className',
            modifier: (value: unknown) => `${value as string}Handler`,
          },
          {
            sourceStep: 'handlerCommand',
            exposedName: 'class',
            consumedName: 'handlerCommandClass',
          },
        ],
        {
          validatorClass: '',
          repositoryClass: '',
        }
      );
    });
  }
}
