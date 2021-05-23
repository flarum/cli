import { StepManager } from '../../steps/step-manager';
import { ComposerInstall } from '../../steps/misc/composer';
import BaseCommand from '../../base-command';
import { BackendTestingInfra } from '../../steps/infra/backend-testing';

export default class BackendTesting extends BaseCommand {
  static description = 'add/update backend testing infrastructure';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .namedStep('testing', new BackendTestingInfra(), {})
      .step(new ComposerInstall(), { optional: true, confirmationMessage: 'Run `composer update`? (recommended)', default: true }, [
        {
          sourceStep: 'testing',
          exposedName: '__succeeded',
          dontRunIfFalsy: true,
        },
      ]);
  }

  protected async additionalPreRunChecks(extRoot: string) {
    await this.confirmOverrideFiles(extRoot, 'tests/integration/setup.php', 'Test infrastructure files already exist. Overwrite with the latest version?');
  }
}
