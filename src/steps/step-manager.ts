import { create as createMemFs, Store } from 'mem-fs';
import { create as createMemFsEditor, Editor } from 'mem-fs-editor';
// @ts-ignore
import { filter, forEachSeries, reduce } from 'modern-async';
import { ParamProvider } from '../provider/param-provider';

export interface Step {
  name: string;

  composable: boolean;

  run: (fs: Store, fsEditor: Editor, paramProvider: ParamProvider) => Promise<Store>;
}

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
    const stepsToRun = await filter(this.steps, async (storedStep: StoredStep) => !storedStep.optional || this.confirmStep(storedStep.confirmationMessage));

    await forEachSeries(stepsToRun.map((storedStep: StoredStep) => storedStep.step), this.runStep.bind(this));

    return stepsToRun.map((storedStep: StoredStep) => storedStep.step.name);
  }

  private async confirmStep(message: string): Promise<boolean> {
    this.paramProvider.reset({});
    return this.paramProvider.get<boolean>({ name: 'execute_step', message, type: 'confirm' });
  }

  private async runStep(step: Step): Promise<boolean> {
    const fs = createMemFs();
    const fsEditor = createMemFsEditor(fs);

    this.paramProvider.reset({});
    const newFs = await step.run(fs, fsEditor, this.paramProvider);

    return new Promise((resolve, _reject) => {
      createMemFsEditor(newFs).commit(err => {
        if (err) {
          throw new Error(err);
        }

        resolve(true);
      });
    });
  }
}
