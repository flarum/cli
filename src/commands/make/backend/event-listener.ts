import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateEventListenerStub } from '../../../steps/stubs/backend/event-listener';
import { GenerateEventListenerExtender } from '../../../steps/extenders/event';

export default class EventListener extends BaseCommand {
  static description = 'Generate an event listener class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .atomicGroup(stepManager => {
        stepManager
          .namedStep('listener', new GenerateEventListenerStub())
          .step(new GenerateEventListenerExtender(), { optional: true, confirmationMessage: 'Generate corresponding extender?', default: true }, [
            {
              sourceStep: 'listener',
              exposedName: 'class',
              consumedName: 'listenerClass',
            },
            {
              sourceStep: 'listener',
              exposedName: 'eventClass',
            },
          ]);
      });
  }
}
