import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateCommandStub } from '../../../steps/stubs/backend/command';
import { GenerateConsoleCommandExtender } from '../../../steps/extenders/console-command';
import { FlarumProviders } from '../../../providers';
import { genExtScaffolder } from '../../../steps/gen-ext-scaffolder';

export default class Command extends BaseCommand {
  static description = 'Generate a console command class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager.atomicGroup((stepManager) => {
      stepManager
        .namedStep('command', new GenerateCommandStub(this.STUB_PATH, genExtScaffolder()))
        .step(new GenerateConsoleCommandExtender(), { optional: true, confirmationMessage: 'Generate corresponding extender?', default: true }, [
          {
            sourceStep: 'command',
            exposedName: 'class',
            consumedName: 'commandClass',
          },
        ]);
    });
  }
}
