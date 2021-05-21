import { create as createMemFs, Store } from 'mem-fs';
import { create as createMemFsEditor, Editor } from 'mem-fs-editor';
import { ParamProvider, Step } from '../contracts/step';
// @ts-ignore
import { filter, forEach, reduce } from 'modern-async';

class ComposedStep implements Step {
  composable = true;

  name: string;

  private steps: Step[];

  constructor(...steps: Step[]) {
    this.steps = steps;
    this.name = `Composition of ${steps.map(s => s.name).join(', ')}`;
  }

  async run(fs: Store, fsEditor: Editor, paramProvider: ParamProvider): Promise<Store> {
    return reduce(this.steps, (acc: Store, currStep: Step) => {
      return currStep.run(acc, fsEditor, paramProvider);
    }, fs);
  }
}

interface StoredStep {
  step: Step;
  optional: boolean;
  confirmationMessage: string;
}

export class StepManager {
  private steps: StoredStep[] = [];

  private paramProvider: ParamProvider;

  constructor(paramProvider: ParamProvider) {
    this.paramProvider = paramProvider;
  }

  /**
   * A step is an incremental operation that updates the filesystem.
   */
  step(step: Step, optional = false, confirmationMessage = ''): this {
    this.steps = [...this.steps, { step, optional, confirmationMessage }];

    return this;
  }

  /**
   * Composed steps are a way of combining multiple steps into one "operation".
   * All user-provided parameters will be shared between them.
   * Composed steps are atomic: the result from one will only be applied if the result from all
   * Composed steps are optional iff the first step is optional.
   */
  composedSteps(steps: Step[], optional = false, confirmationMessage = ''): this {
    steps.filter(step => !step.composable).forEach(step => {
      throw new Error(`The step "${step.name}" is not composable.`);
    });

    const step = new ComposedStep(...steps);

    return this.step(step, optional, confirmationMessage);
  }

  async run(): Promise<string[]> {
    const stepsToRun = (await filter(this.steps, async (storedStep: StoredStep) => !storedStep.optional || this.confirmStep(storedStep.confirmationMessage)))
      .map((storedStep: StoredStep) => storedStep.step);

    await forEach(stepsToRun, async (step: Step) => {
      await this.runStep(step);
    });

    return stepsToRun.map((step: Step) => step.name);
  }

  private async confirmStep(message: string): Promise<boolean> {
    this.paramProvider.reset({});
    return this.paramProvider.get<boolean>({ name: 'execute_step', message, type: 'confirm' });
  }

  private async runStep(step: Step): Promise<void> {
    const fs = createMemFs();
    const fsEditor = createMemFsEditor(fs);

    this.paramProvider.reset({});
    const newFs = await step.run(fs, fsEditor, this.paramProvider);

    await new Promise((resolve, _reject) => {
      createMemFsEditor(newFs).commit(err => {
        if (err) {
          throw new Error(err);
        }

        resolve(0);
      });
    });
  }
}
