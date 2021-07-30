import { StepManager } from '../../../steps/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateServiceProviderStub } from '../../../steps/stubs/backend/service-provider';
import { GenerateServiceProviderExtender } from '../../../steps/extenders/service-provider';

export default class ServiceProvider extends BaseCommand {
  static description = 'Generate a service provider class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .atomicGroup(stepManager => {
        stepManager
          .namedStep('provider', new GenerateServiceProviderStub())
          .step(new GenerateServiceProviderExtender(), { optional: true, confirmationMessage: 'Generate corresponding extender?', default: true }, [
            {
              sourceStep: 'provider',
              exposedName: 'class',
              consumedName: 'providerClass',
            },
          ]);
      });
  }
}
