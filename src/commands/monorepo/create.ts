import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../base-command';
import { FlarumProviders } from '../../providers';
import { Flags } from '@oclif/core';
import { MonorepoCreate } from '../../steps/monorepo/create';
import { genExtScaffolder } from '../../steps/gen-ext-scaffolder';

export default class Create extends BaseCommand {
  static description = 'Create a monorepo of Flarum extensions.';

  static flags = {
    config: Flags.string({ char: 'c', required: false }),
    ...BaseCommand.flags,
  };

  static args = [...BaseCommand.args];

  protected requireExistingExtension = false;

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager.step(new MonorepoCreate(genExtScaffolder(), this.flags.config));
  }
}
