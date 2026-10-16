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
import { IO, Message } from 'boilersmith/io';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import simpleGit from 'simple-git';

/**
 * The temporary worktree a check runs the steps in, so the extension itself
 * is never changed.
 */
type Checkout = {
  /** The repository the extension is in. */
  repo: string;
  worktree: string;
  branch: string;
  /** The extension's root inside the worktree. */
  root: string;
  /** What was checked. */
  commit: string;
  /** Whether the extension had changes not committed, which a check leaves out. */
  dirty: boolean;
  cwd: string;
};

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
    check: Flags.boolean({
      description:
        'Report what the upgrade would change, such as on an extension already on Flarum 2.0, without changing it: the steps run on the last commit, in a temporary git worktree that is removed afterwards. Implies --force-steps and --no-interaction.',
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

  protected checkout: Checkout | null = null;

  async run(): Promise<void> {
    try {
      await super.run();
    } finally {
      await this.removeCheckout();
    }
  }

  protected async additionalPreRunChecks(extRoot: string): Promise<void> {
    if (this.flags.check) {
      this.checkout = await this.createCheckout(extRoot);
    }
  }

  protected stepsPath(requested: string | undefined): string | undefined {
    return this.checkout?.root ?? requested;
  }

  protected genIO(): IO {
    // A check asks nothing: there is nothing to confirm.
    if (this.flags?.check) this.flags['no-interaction'] = true;

    return super.genIO();
  }

  protected async createCheckout(extRoot: string): Promise<Checkout> {
    const root = fs.realpathSync(extRoot);
    const git = simpleGit(root);

    let repo: string;

    try {
      repo = (await git.revparse(['--show-toplevel'])).trim();
    } catch {
      this.error('--check runs the upgrade on a copy of the extension in a git worktree, so the extension must be in a git repository.', {
        code: 'FL_ERR',
      });
    }

    const commit = (await git.revparse(['HEAD'])).trim();
    const dirty = !(await git.status()).isClean();
    const worktree = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'flarum-upgrade-check-'));
    const branch = `flarum-upgrade-check/${path.basename(worktree)}`;

    await simpleGit(repo).raw(['worktree', 'add', '--quiet', '-b', branch, worktree, commit]);

    return { repo, worktree, branch, root: path.join(worktree, path.relative(repo, root)), commit, dirty, cwd: process.cwd() };
  }

  /** Remove the worktree and its branch, saying so if it can't. */
  protected async removeCheckout(): Promise<void> {
    const checkout = this.checkout;

    if (!checkout) return;

    this.checkout = null;

    // The steps ran from inside the worktree.
    process.chdir(checkout.cwd);

    try {
      await simpleGit(checkout.repo).raw(['worktree', 'remove', '--force', checkout.worktree]);
      await simpleGit(checkout.repo).raw(['branch', '-D', checkout.branch]);
    } catch (error) {
      process.stderr.write(
        `The check could not remove its worktree ${checkout.worktree} and branch ${checkout.branch}: ${(error as Error).message}\n` +
          `Remove them with: git worktree remove --force ${checkout.worktree} && git branch -D ${checkout.branch}\n`
      );
    }
  }

  /** What a step that committed in the worktree would change, from its commit. */
  protected wouldChange(sha: string): { files: string[]; diff: string } {
    const show = (...args: string[]) =>
      execFileSync('git', ['show', '--format=', '--no-color', '--no-ext-diff', ...args, sha], { cwd: this.checkout!.worktree, encoding: 'utf8' });

    return { files: show('--name-only').split('\n').filter(Boolean), diff: show() };
  }

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
      const step = new Step(this, this.checkout?.root ?? extRoot, stepCount, total, this.flags['force-steps'] || this.flags.check);
      step.checking = Boolean(this.flags.check);
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
      ...(this.checkout && { check: { commit: this.checkout.commit, uncommittedChangesLeftOut: this.checkout.dirty } }),
      steps: this.scheduled.map((step) => ({
        step: step.number,
        title: step.type,
        ...this.reported(step),
      })),
    };
  }

  /** A step's outcome, as what it would change when checking. */
  protected reported(step: BaseUpgradeStep): Record<string, unknown> {
    const outcome = step.outcome ?? { status: 'not-run' };

    if (!this.checkout || outcome.status !== 'committed') return outcome;

    return { status: 'would-change', ...this.wouldChange(outcome.commit.sha), notes: outcome.notes, todos: outcome.todos };
  }

  protected welcomeMessage(): string {
    if (this.flags.check) {
      return `
    Checking what the Flarum 2.0 upgrade would change in your extension. The steps run on its last commit,
    in a temporary git worktree that is removed afterwards: nothing in your extension changes.
    `;
    }

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
    if (this.checkout) {
      const changing = this.scheduled.filter((step) => step.outcome?.status === 'committed');
      const lines = changing.map((step) => {
        const { files } = this.wouldChange((step.outcome as { commit: { sha: string } }).commit.sha);

        return `    - Step ${step.number}, ${step.type} ${chalk.dim(files.join(', '))}`;
      });

      return [
        changing.length > 0
          ? `    ${changing.length} of the steps would change something in ${this.checkout.commit.slice(0, 7)}:`
          : `    None of the steps would change anything in ${this.checkout.commit.slice(0, 7)}.`,
        ...lines,
        this.checkout.dirty && '    Changes that were not committed were left out of the check.',
        '',
        '    Nothing was changed. Run with --json as well to see each diff, or without --check to make the changes.',
        '',
      ]
        .filter((line) => line !== false)
        .join('\n');
    }

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
