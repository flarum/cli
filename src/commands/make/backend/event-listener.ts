import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateEventListenerStub } from '../../../steps/stubs/backend/event-listener';
import { GenerateEventListenerExtender } from '../../../steps/extenders/event';
import { genExtScaffolder } from '../../../steps/gen-ext-scaffolder';
import { FlarumProviders } from '../../../providers';

export default class EventListener extends BaseCommand {
  static description = 'Generate an event listener class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager
      .atomicGroup(stepManager => {
        stepManager
          .namedStep('listener', new GenerateEventListenerStub(this.STUB_PATH, genExtScaffolder()))
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
