import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../base-command';
import { FlarumProviders } from '../../providers';
import { genExtScaffolder } from '../../steps/gen-ext-scaffolder';
import { Flags } from '@oclif/core';

export default class AuditInfra extends BaseCommand {
  static description = 'Check for outdated config files, infrastructure, setup, etc.';

  static flags = {
    fix: Flags.boolean({ char: 'f', default: false }),
    monorepo: Flags.boolean({ char: 'm', default: false }),
    ...BaseCommand.flags,
  };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    this.dry = !this.flags.fix;

    const mapPaths = this.flags.monorepo ? this.monorepoPaths({
      includeCore: true,
      includeExtensions: true,
      includePhpPackages: false,
      includeJSPackages: false,
    }) : [];
    stepManager.step(genExtScaffolder().genAuditStep(!this.flags.fix), {}, [], {}, mapPaths);

    return stepManager;
  }

  protected async additionalPreRunChecks(extRoot: string): Promise<void> {
    const files = genExtScaffolder().moduleFiles(this.args.module);
    await this.confirmOverrideFiles(extRoot, files, 'Infrastructure files already exist. Overwrite with the latest version?');
  }
}
