import { StepManager } from '../steps/step-manager';
import { ExtensionSkeleton } from '../steps/init/extension-skeleton';
import { ComposerInstall } from '../steps/misc/composer';
import { YarnInstall } from '../steps/misc/yarn';
import BaseCommand from '../base-command';

export default class Init extends BaseCommand {
  static description = 'create a new Flarum extension';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected requireEmptyDir = true;

  protected requireExistingExtension = false;

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .step(new ExtensionSkeleton())
      .step(new ComposerInstall(), { optional: true, confirmationMessage: 'Run `composer install`? (recommended)', default: true})
      .step(new YarnInstall(), { optional: true, confirmationMessage: 'Run `yarn install`? (recommended)', default: true });
  }
}
