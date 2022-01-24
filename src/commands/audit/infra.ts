import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../base-command';
import { FlarumProviders } from '../../providers';
import { genExtScaffolder } from '../../steps/gen-ext-scaffolder';
import { Flags } from '@oclif/core';
import { YarnInstall } from '../../steps/misc/yarn';
import { ComposerInstall } from '../../steps/misc/composer';
import { NpmInstall } from '../../steps/misc/npm';

export default class AuditInfra extends BaseCommand {
  static description = 'Check for outdated config files, infrastructure, setup, etc.';

  static flags = {
    fix: Flags.boolean({ char: 'f', default: false }),
    monorepo: Flags.boolean({ char: 'm', default: false }),
    ...BaseCommand.flags,
  };

  static args = [...BaseCommand.args];

  protected steps(stepManager: StepManager<FlarumProviders>, extRoot: string): StepManager<FlarumProviders> {
    this.dry = !this.flags.fix;

    const mapPaths = this.flags.monorepo
      ? this.monorepoPaths({
          includeCore: true,
          includeExtensions: true,
          includePhpPackages: false,
          includeJSPackages: false,
        })
      : [];
    stepManager.namedStep('audit', genExtScaffolder().genAuditStep(!this.flags.fix), {}, [], {}, mapPaths);

    if (!this.flags.monorepo && !this.dry) {
      const packageManager = this.jsPackageManager(extRoot);
      stepManager.step(
        packageManager === 'npm' ? new NpmInstall() : new YarnInstall(),
        { optional: true, confirmationMessage: `Run \`${packageManager ?? 'yarn'}\`? (recommended)`, default: true },
        [
          {
            sourceStep: 'audit',
            exposedName: '__succeeded',
            dontRunIfFalsy: true,
          },
        ]
      );
      stepManager.step(new ComposerInstall(), { optional: true, confirmationMessage: 'Run `composer update`? (recommended)', default: true }, [
        {
          sourceStep: 'audit',
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
