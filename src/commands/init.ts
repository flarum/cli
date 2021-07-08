import { StepManager } from '../steps/step-manager';
import { ExtensionSkeleton } from '../steps/init/extension-skeleton';
import { ComposerInstall } from '../steps/misc/composer';
import { YarnInstall } from '../steps/misc/yarn';
import BaseCommand from '../base-command';
import yosay from 'yosay';

export default class Init extends BaseCommand {
  static description = 'Create a new Flarum extension';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected requireExistingExtension = false;

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .namedStep('skeleton', new ExtensionSkeleton(), {})
      .step(new ComposerInstall(), { optional: true, confirmationMessage: 'Run `composer install`? (recommended)', default: true})
      .step(new YarnInstall(), { optional: true, confirmationMessage: 'Run `yarn install`? (recommended)', default: true }, [
        {
          sourceStep: 'skeleton',
          exposedName: 'useJs',
          dontRunIfFalsy: true,
        },
      ]);
  }

  protected welcomeMessage() {
    return yosay('Welcome to a Flarum extension generator\n\n- Flarum Team');
  }

  protected goodbyeMessage() {
    return 'Extension generation complete! Visit https://docs.flarum.org/extend to learn more about Flarume extension development.';
  }

  protected async additionalPreRunChecks(extRoot: string) {
    if (await this.confirmOverrideFiles(extRoot, '**/*', 'Directory not empty. Overwrite?')) {
      this.deleteFiles(extRoot, '**/*');
    }
  }
}
