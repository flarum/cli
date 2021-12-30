import { StepManager } from 'boilersmith/step-manager';
import { UpdateJSImports } from '../../steps/update/js-imports';
import BaseCommand from '../../base-command';

export default class UpdateJsImports extends BaseCommand {
  static description = 'Updates JS imports from core to use proper namespaces';

  static flags = { ...BaseCommand.flags };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager): StepManager {
    return stepManager
      .step(new UpdateJSImports());
  }

  protected async additionalPreRunChecks(extRoot: string): Promise<void> {
    await this.ensureComposerInstallRan(extRoot);
  }
}
