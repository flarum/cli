import { StepManager } from 'boilersmith/step-manager';
import { ComposerInstall } from '../steps/misc/composer';
import BaseCommand from '../base-command';
import { FlarumProviders } from 'src/providers';
import { EXTENSION_MODULES, genExtScaffolder } from 'src/steps/gen-ext-scaffolder';

export default class Infra extends BaseCommand {
  static description = 'Add/Update backend testing infrastructure';

  static flags = { ...BaseCommand.flags };

  static args = [{
    name: 'module',
    description: 'The name of the module to enable/update.',
    required: true,
    options: [...EXTENSION_MODULES],
  }, ...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager
      .namedStep('infra', genExtScaffolder().genInfraStep(this.args.module))
      .step(new ComposerInstall(), { optional: true, confirmationMessage: 'Run `composer update`? (recommended)', default: true }, [
        {
          sourceStep: 'infra',
          exposedName: '__succeeded',
          dontRunIfFalsy: true,
        },
      ]);
  }

  protected async additionalPreRunChecks(extRoot: string): Promise<void> {
    await this.confirmOverrideFiles(extRoot, 'tests/integration/setup.php', 'Test infrastructure files already exist. Overwrite with the latest version?');
  }
}
