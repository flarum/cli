import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../../base-command';
import { GenerateServiceProviderStub } from '../../../steps/stubs/backend/service-provider';
import { GenerateServiceProviderExtender } from '../../../steps/extenders/service-provider';
import { FlarumProviders } from '../../../providers';
import { genExtScaffolder } from '../../../steps/gen-ext-scaffolder';

export default class ServiceProvider extends BaseCommand {
  static description = 'Generate a service provider class';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager.atomicGroup((stepManager) => {
      stepManager
        .namedStep('provider', new GenerateServiceProviderStub(this.STUB_PATH, genExtScaffolder()))
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
