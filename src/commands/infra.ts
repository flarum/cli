import { StepManager } from 'boilersmith/step-manager';
import { ComposerInstall } from '../steps/misc/composer';
import BaseCommand from '../base-command';
import { FlarumProviders } from '../providers';
import { ExtensionModules, EXTENSION_MODULES, genExtScaffolder } from '../steps/gen-ext-scaffolder';
import { NpmInstall } from '../steps/misc/npm';
import { YarnInstall } from '../steps/misc/yarn';
import { Flags } from '@oclif/core';

export default class Infra extends BaseCommand {
  static description =
    'Add/Update infrastructure to the latest scaffolding for some module in an extension. For example, you can use this to add/update TypeScript, backend testing, GitHub Actions, and other features.';

  static flags = {
    monorepo: Flags.boolean({ char: 'm', default: false }),
    ...BaseCommand.flags,
  };

  static args = [
    {
      name: 'module',
      description: 'The name of the module to enable/update.',
      required: true,
      options: [...EXTENSION_MODULES],
    },
    ...BaseCommand.args,
  ];

  protected steps(stepManager: StepManager<FlarumProviders>, extRoot: string): StepManager<FlarumProviders> {
    const module = this.args.module as ExtensionModules;
    const mapPaths = this.flags.monorepo
      ? this.monorepoPaths({
          includeCore: true,
          includeExtensions: true,
          includePhpPackages: false,
          includeJSPackages: false,
        })
      : [];
    stepManager.namedStep('infra', genExtScaffolder().genInfraStep(this.args.module), {}, [], {}, mapPaths);

    const JS_MODULES = ['js', 'prettier', 'typescript'];
    const PHP_MODULES = ['backendTesting'];

    const packageManager = this.jsPackageManager(extRoot);
    if (!this.flags.monorepo && JS_MODULES.includes(module)) {
      stepManager.step(
        packageManager === 'npm' ? new NpmInstall() : new YarnInstall(),
        { optional: true, confirmationMessage: `Run \`${packageManager ?? 'yarn'}\`? (recommended)`, default: true },
        [
          {
            sourceStep: 'infra',
            exposedName: '__succeeded',
            dontRunIfFalsy: true,
          },
        ]
      );
    }

    if (!this.flags.monorepo && PHP_MODULES.includes(module)) {
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
