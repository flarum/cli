import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../base-command';
import { FlarumProviders } from '../../providers';
import { Flags } from '@oclif/core';
import { MonorepoSplit } from '../../steps/monorepo/split';

export default class Split extends BaseCommand {
  static description = 'Split monorepo changes into subrepos.';

  static flags = {
    config: Flags.string({ char: 'c', required: false }),
    ...BaseCommand.flags,
  };

  static args = [...BaseCommand.args];

  protected requireExistingExtension = false;

  protected steps(stepManager: StepManager<FlarumProviders>): StepManager<FlarumProviders> {
    return stepManager.step(new MonorepoSplit());
  }
}
