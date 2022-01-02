import { StepManager } from 'boilersmith/step-manager';
import { ComposerInstall } from '../steps/misc/composer';
import BaseCommand from '../base-command';
import { FlarumProviders } from '../providers';
import { ExtensionModules, EXTENSION_MODULES, genExtScaffolder } from '../steps/gen-ext-scaffolder';
import { YarnInstall } from '../steps/misc/yarn';

export default class Infra extends BaseCommand {
  static description = 'Add/Update infrastructure to the latest scaffolding for some module in an extension. For example, you can use this to add/update TypeScript, backend testing, GitHub Actions, and other features.';

  static flags = { ...BaseCommand.flags };

  static args = [{
    name: 'module',
    description: 'The name of the module to enable/update.',
    required: true,
    options: [...EXTENSION_MODULES],
  }, ...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    const module = this.args.module as ExtensionModules;
    stepManager
      .namedStep('infra', genExtScaffolder().genInfraStep(this.args.module));

    const JS_MODULES = ['js', 'prettier', 'typescript'];
    const PHP_MODULES = ['backendTesting'];

    if (JS_MODULES.includes(module)) {
      stepManager.step(new YarnInstall(), { optional: true, confirmationMessage: 'Run `yarn`? (recommended)', default: true }, [
        {
          sourceStep: 'infra',
          exposedName: '__succeeded',
          dontRunIfFalsy: true,
        },
      ]);
    }

    if (PHP_MODULES.includes(module)) {
      stepManager.step(new ComposerInstall(), { optional: true, confirmationMessage: 'Run `composer update`? (recommended)', default: true }, [
        {
          sourceStep: 'infra',
          exposedName: '__succeeded',
          dontRunIfFalsy: true,
        },
      ]);
    }

    return stepManager;
  }

  protected async additionalPreRunChecks(extRoot: string): Promise<void> {
    const files = genExtScaffolder().moduleFiles(this.args.module);
    await this.confirmOverrideFiles(extRoot, files, 'Infrastructure files already exist. Overwrite with the latest version?');
  }
}
