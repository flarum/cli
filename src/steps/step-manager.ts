/* eslint-disable no-await-in-loop */
import { create as createMemFs, Store } from 'mem-fs';
import { create as createMemFsEditor } from 'mem-fs-editor';
import { ParamProvider, ParamProviderFactory } from '../provider/param-provider';
import { PathProvider } from '../provider/path-provider';
import { PhpProvider } from '../provider/php-provider';

export interface Step {
  /**
   * A short string describing what the step does.
   */
  type: string;

  /**
   * Can this step be composed with other steps?
   *
   * This is the case if the step makes no changes to the disk filesystem while running.
   */
  composable: boolean;

  /**
   * A list of names of params that this step exposes to other steps.
   */
  exposes: string[];

  run: (fs: Store, pathProvider: PathProvider, paramProvider: ParamProvider, phpProvider: PhpProvider) => Promise<Store>;

  /**
   * Return an object of exposed params.
   *
   * The pathProvider and paramProvider will be the same objects provided to the `run` method.
   */
  getExposed(pathProvider: PathProvider, paramProvider: ParamProvider): Record<string, unknown>;
}

interface ShouldRunConfig {
  optional?: boolean;
  confirmationMessage?: string;
  default?: boolean;

}

interface StoredStep {
  name?: string;
  step: Step;
  shouldRun: ShouldRunConfig;
  dependencies: StepDependency[];
}

interface StepDependency {
  sourceStep: string;
  exposedName: string;
  consumedName?: string;
}

export class StepManager {
  protected steps: Array<StoredStep | AtomicStepManager> = [];

  protected namedSteps = new Map<string, StoredStep>();

  protected exposedParams = new Map<string, Record<string, unknown>>();

  /**
   * A step is an incremental operation that updates the filesystem.
   */
  step(step: Step, shouldRun: ShouldRunConfig = {}, dependencies: StepDependency[] = []): this {
    this.validateDependencies(step, dependencies);

    this.steps = [...this.steps, { step, shouldRun, dependencies }];

    return this;
  }

  namedStep(name: string, step: Step, shouldRun: ShouldRunConfig = {}, dependencies: StepDependency[] = []): this {
    if (this.namedSteps.has(name)) {
      throw new Error(`Named steps must have unique names. A step with name "${name}" already exists.`);
    }

    this.validateDependencies(step, dependencies);

    const newStep = { name, step, shouldRun, dependencies };

    this.steps = [...this.steps, newStep];

    this.namedSteps.set(name, newStep);

    return this;
  }

  atomicGroup(callback: (stepManager: AtomicStepManager) => void) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const atomicCollection = new AtomicStepManager(this.namedSteps, this.exposedParams);

    callback(atomicCollection);

    this.steps = [...this.steps, atomicCollection];

    return this;
  }

  protected validateDependencies(step: Step, dependencies: StepDependency[]) {
    const format = (strings: string[]) => strings
      .map(s => `"${s}"`)
      .join(', ');

    const missingDependencySteps = dependencies
      .map(dep => dep.sourceStep)
      .filter(stepName => !this.namedSteps.has(stepName));

    if (missingDependencySteps.length > 0) {
      throw new Error(`Step of type "${step.type}" depends on nonexistent named steps ${format(missingDependencySteps)}`);
    }

    const missingDependencyParams: string[] = [];
    const missingDependencyParamSteps: string[] = [];

    dependencies.forEach(dependency => {
      const sourceStep = this.namedSteps.get(dependency.sourceStep);

      if (!sourceStep?.step.exposes.includes(dependency.exposedName)) {
        missingDependencyParamSteps.push(sourceStep?.name as string);
        missingDependencyParams.push(dependency.exposedName);
      }
    });

    if (missingDependencyParamSteps.length > 0) {
      throw new Error(`Step of type "${step.type}" depends on nonexistent exposed params ${format(missingDependencyParams)} from named steps ${format(missingDependencyParamSteps)}`);
    }
  }

  async run(pathProvider: PathProvider, paramProviderFactory: ParamProviderFactory, phpProvider: PhpProvider): Promise<string[]> {
    const stepNames: string[] = [];

    for (let i = 0; i < this.steps.length; i++) {
      const storedStep = this.steps[i];

      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      if (storedStep instanceof AtomicStepManager) {
        const res = await storedStep.run(pathProvider, paramProviderFactory, phpProvider);
        stepNames.push(...res);
      } else {
        const shouldRun: boolean = await this.stepShouldRun(storedStep, paramProviderFactory);
        if (!shouldRun) continue;
        const fs = await this.runStep(storedStep, pathProvider, paramProviderFactory, phpProvider);

        await this.commit(fs);

        stepNames.push(storedStep.step.type);
      }
    }

    return stepNames;
  }

  protected async stepShouldRun(storedStep: StoredStep, paramProviderFactory: ParamProviderFactory): Promise<boolean> {
    const allDependenciesRan = storedStep.dependencies.every(dep => this.exposedParams.has(dep.sourceStep));
    if (!allDependenciesRan) return false;

    if (!storedStep.shouldRun.optional) return true;

    const promptConfirm = await paramProviderFactory({context: 'Confirm Step'}).get<boolean>({
      name: 'execute_step',
      message: storedStep.shouldRun.confirmationMessage || `Run step of type "${storedStep.step.type}"?`,
      initial: storedStep.shouldRun.default || false,
      type: 'confirm',
    });

    return promptConfirm;
  }

  protected async runStep(storedStep: StoredStep, pathProvider: PathProvider, paramProviderFactory: ParamProviderFactory, phpProvider: PhpProvider): Promise<Store> {
    const fs = createMemFs();

    const initial: Record<string, unknown> = storedStep.dependencies.reduce((initial, dep) => {
      initial[dep.consumedName || dep.exposedName] = this.exposedParams.get(dep.sourceStep)![dep.exposedName];

      return initial;
    }, {} as Record<string, unknown>);

    const paramProvider = paramProviderFactory(initial);

    const newFs = await storedStep.step.run(fs, pathProvider, paramProvider, phpProvider);

    if (storedStep.name) {
      this.exposedParams.set(storedStep.name, storedStep.step.getExposed(pathProvider, paramProvider));
    }

    return newFs;
  }

  protected async commit(fs: Store): Promise<boolean> {
    return new Promise((resolve, _reject) => {
      createMemFsEditor(fs).commit(err => {
        if (err) {
          throw new Error(err);
        }

        resolve(true);
      });
    });
  }
}

class AtomicStepManager extends StepManager {
  constructor(parentNamedSteps: Map<string, StoredStep>, parentExposedParams: Map<string, Record<string, unknown>>) {
    super();
    this.namedSteps = parentNamedSteps;
    this.exposedParams = parentExposedParams;
  }

  step(step: Step, shouldRun: ShouldRunConfig = {}, dependencies: StepDependency[] = []): this {
    if (!step.composable) {
      throw new Error(`Step of type "${step.type}" is not composable, and cannot be added to an atomic group.`);
    }

    return super.step(step, shouldRun, dependencies);
  }

  namedStep(name: string, step: Step, shouldRun: ShouldRunConfig = {}, dependencies: StepDependency[] = []): this {
    if (!step.composable) {
      throw new Error(`Step of type "${step.type}" is not composable, and cannot be added to an atomic group.`);
    }

    return super.namedStep(name, step, shouldRun, dependencies);
  }

  atomicGroup(_callback: (stepManager: AtomicStepManager) => void): this {
    throw new Error("Atomic groups can't be nested.");
  }

  async run(pathProvider: PathProvider, paramProviderFactory: ParamProviderFactory, phpProvider: PhpProvider): Promise<string[]> {
    let fs = createMemFs();

    const stepNames: string[] = [];

    for (let i = 0; i < this.steps.length; i++) {
      const storedStep = this.steps[i] as StoredStep;

      const shouldRun: boolean = await this.stepShouldRun(storedStep, paramProviderFactory);
      if (!shouldRun) continue;

      fs = await this.runStep(storedStep, pathProvider, paramProviderFactory, phpProvider);

      stepNames.push(storedStep.step.type);
    }

    await this.commit(fs);

    return stepNames;
  }
}
