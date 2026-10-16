import { StepManager } from 'boilersmith/step-manager';
import BaseCommand from '../../base-command';
import { FlarumProviders } from '../../providers';
import Dependencies from '../../steps/upgrade/twopointoh/dependencies';
import Infrastructure from '../../steps/upgrade/twopointoh/infra';
import ImportExt from '../../steps/upgrade/twopointoh/frontend/export-registry/import-ext';
import Compat from '../../steps/upgrade/twopointoh/frontend/export-registry/compat';
import UsageOfLazyModules from '../../steps/upgrade/twopointoh/frontend/code-splitting/usage-of-lazy-modules';
import MiscFrontendChanges from '../../steps/upgrade/twopointoh/frontend/misc';
import AdminExtender from '../../steps/upgrade/twopointoh/frontend/admin-extender';
import FormatCode from '../../steps/upgrade/twopointoh/frontend/format';
import chalk from 'chalk';
import MiscBackendChanges from '../../steps/upgrade/twopointoh/backend/misc';
import Filesystem from '../../steps/upgrade/twopointoh/backend/filesystem';
import Mailer from '../../steps/upgrade/twopointoh/backend/mailer';
import JsonApi from '../../steps/upgrade/twopointoh/backend/json-api';
import Search from '../../steps/upgrade/twopointoh/backend/search';
import LessChanges from '../../steps/upgrade/twopointoh/less';
import PhpUnit from '../../steps/upgrade/twopointoh/backend/phpunit';
import ModelFactories from '../../steps/upgrade/twopointoh/backend/model-factories';
import { Flags } from '@oclif/core';
import EmailViews from '../../steps/upgrade/twopointoh/backend/email-views';
import InterventionImage from '../../steps/upgrade/twopointoh/backend/intervention-image';
import { BaseUpgradeStep } from '../../steps/upgrade/twopointoh/base';
import { Message } from 'boilersmith/io';

export default class TwoPointOh extends BaseCommand {
  static description = 'Upgrade an extension to Flarum 2.0';

  static enableJsonFlag = true;

  static flags = {
    ...BaseCommand.flags,
    json: Flags.boolean({
      description:
        "Report each step's outcome, failures, notes and the @TODOs it left as JSON, for a program driving the upgrade. Implies --no-interaction.",
      required: false,
    }),
    step: Flags.string({
      description: 'Optionally specify a specific step to run',
      required: false,
    }),
    'force-steps': Flags.boolean({
      description: 'Force run steps even if already ran',
      required: false,
    }),
  };

  static args = [...BaseCommand.args];

  protected requireExistingExtension = true;

  skipFinalMessage = true;

  /**
   * The steps this run was asked to take, in order.
   */
  protected scheduled: BaseUpgradeStep[] = [];

  protected steps(steps: StepManager<FlarumProviders>, extRoot: string): StepManager<FlarumProviders> {
    // Error.stackTraceLimit = Number.POSITIVE_INFINITY;

    return this.prepareSteps(
      steps,
      [
        // Frontend
        FormatCode,
        Dependencies,
        Infrastructure,
        Compat,
        ImportExt,
        UsageOfLazyModules,
        MiscFrontendChanges,
        AdminExtender,
        // Backend
        MiscBackendChanges,
        Filesystem,
        Mailer,
        EmailViews,
        JsonApi,
        InterventionImage,
        Search,
        ModelFactories,
        PhpUnit,
        // LESS
        LessChanges,
      ],
      extRoot
    );
  }

  private prepareSteps(steps: StepManager<FlarumProviders>, collection: any[], extRoot: string): StepManager<FlarumProviders> {
    let total = 0;
    let stepCount = 1;

    collection.forEach(() => {
      total++;
    });

    collection = collection.map((Step: new (...args: any) => any) => {
      const step = new Step(this, extRoot, stepCount, total, this.flags['force-steps']);
      stepCount++;
      return step;
    });

    if (this.flags.step) {
      const step = Number.parseInt(this.flags.step as string, 10);

      if (step > 0 && step <= total) {
        this.scheduled = [collection[step - 1]];

        return steps.step(collection[step - 1]);
      }

      this.error(`Invalid step number. Please provide a number between 1 and ${total}`);
    }

    this.scheduled = collection;

    collection.forEach((step) => {
      steps.step(step);
    });

    return steps;
  }

  protected jsonReport(succeeded: boolean, error: string | null, messages: Message[]): Record<string, unknown> {
    return {
      ...super.jsonReport(succeeded, error, messages),
      steps: this.scheduled.map((step) => ({
        step: step.number,
        title: step.type,
        ...(step.outcome ?? { status: 'not-run' }),
      })),
    };
  }

  protected welcomeMessage(): string {
    const beforeProceeding = chalk.bold.red('Before proceeding:');
    const command = chalk.bold.bgYellow.black('fl update js-imports');
    const makeSure = chalk.bold.dim(`- Make sure your extend.php file directly returns an array of extenders.
    - All JS imports from Flarum are frontend-specific. (You can use ${command} to update them)
    - You have read the full upgrade guide at least once: https://docs.flarum.org/2.x/extend/update-2_0
    - For better results, make sure your CRUD controllers if any are properly named: Create{Model}Controller, Update{Model}Controller, etc.`);

    return `
    Welcome to the Flarum 2.0 upgrade process. This command will attempt to upgrade your extension code to be compatible with Flarum 2.0
    Make sure you have no current uncommitted changes. Each step will be committed to git, so you can easily revert if something goes wrong.
    Some changes cannot be made by the tool, so you may need to manually update your code. References to the Flarum 2.0 upgrade guide will be provided.

    ${beforeProceeding}
    ${makeSure}
    `;
  }

  protected goodbyeMessage(): string {
    const composer = chalk.bold.bgYellow('composer update');
    const yarn = chalk.bold.bgYellow('yarn install');

    return `    Your extension has been successfully upgraded to Flarum 2.0.
    You may need to make some manual changes to your code. Look for added @TODO comments in your code.
    Please refer to the Flarum 2.0 upgrade guide for more information.
    https://docs.flarum.org/2.x/extend/update-2_0

    Make sure to run ${composer} and ${yarn} then test your extension to ensure everything is working as expected.
    `;
  }
}
