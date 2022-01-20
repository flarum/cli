import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateApiControllerStub } from '../../../steps/stubs/backend/api-controller';
import { GenerateRoutesExtender } from '../../../steps/extenders/route';
import { genExtScaffolder } from '../../../steps/gen-ext-scaffolder';
import { FlarumProviders } from '../../../providers';

export default class ApiController extends BaseCommand {
  static description = 'Generate an API controller class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager.atomicGroup((stepManager) => {
      stepManager
        .namedStep('apiController', new GenerateApiControllerStub(this.STUB_PATH, genExtScaffolder()))
        .step(new GenerateRoutesExtender(), { optional: true, confirmationMessage: 'Generate corresponding extender?', default: true }, [
          {
            sourceStep: 'apiController',
            exposedName: 'class',
            consumedName: 'routeHandler',
          },
        ]);
    });
  }
}
