import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateHandlerCommandStub } from '../../../steps/stubs/backend/handler-command';
import { GenerateHandlerStub } from '../../../steps/stubs/backend/handler';

export default class ApiController extends BaseCommand {
  static description = 'Generate a domain logic handler class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .atomicGroup(stepManager => {
        stepManager
          .namedStep('handlerCommand', new GenerateHandlerCommandStub())
          .step(new GenerateHandlerStub(), {}, [
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
            {
              sourceStep: 'handlerCommand',
              exposedName: 'classType',
            },
          ]);
      });
  }
}
