import { StepManager } from 'boilersmith/step-manager';
import { ComposerInstall } from '../steps/misc/composer';
import { YarnInstall } from '../steps/misc/yarn';
import BaseCommand from '../base-command';
import yosay from 'yosay';
import { FlarumProviders } from '../providers';
import { genExtScaffolder } from '../steps/gen-ext-scaffolder';
import { GitInit } from '../steps/misc/git';

export default class Init extends BaseCommand {
  static description = 'Create a new Flarum extension';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected requireExistingExtension = false;

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager
      .namedStep('gitInit', new GitInit(), { optional: true, confirmationMessage: 'Run `git init`? (recommended)', default: true })
      .namedStep('skeleton', genExtScaffolder().genInitStep())
      .step(new ComposerInstall(), { optional: true, confirmationMessage: 'Run `composer install`? (recommended)', default: true })
      .step(new YarnInstall(), { optional: true, confirmationMessage: 'Run `yarn install`? (recommended)', default: true }, [
        {
          sourceStep: 'skeleton',
          exposedName: 'modules.js',
          dontRunIfFalsy: true,
        },
      ]);
  }

  protected welcomeMessage(): string {
    return yosay('Welcome to a Flarum extension generator\n\n- Flarum Team');
  }

  protected goodbyeMessage(): string {
    return 'Extension generation complete! Visit https://docs.flarum.org/extend to learn more about Flarum extension development.';
  }

  protected async additionalPreRunChecks(extRoot: string): Promise<void> {
    if (await this.confirmOverrideFiles(extRoot, '**/*', 'Directory not empty. Overwrite?')) {
      this.deleteFiles(extRoot, '**/*');
    }
  }
}
