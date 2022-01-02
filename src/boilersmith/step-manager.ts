/* eslint-disable no-await-in-loop */
import { create as createMemFs, Store } from 'mem-fs';
import { create as createMemFsEditor } from 'mem-fs-editor';
import { IO, IOFactory } from './io';
import { Paths } from './paths';

// eslint-disable-next-line @typescript-eslint/ban-types
export type DefaultProviders = {};

export interface Step<Providers extends DefaultProviders = DefaultProviders, Exposes extends string = string> {
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
  exposes: Exposes[];

  run: (fs: Store, paths: Paths, io: IO, providers: Providers) => Promise<Store>;

  /**
   * Return an object of exposed params.
   *
   * The paths and io will be the same objects provided to the `run` method.
   */
  getExposed(paths: Paths, io: IO): Record<Exposes, unknown>;
}

interface ShouldRunConfig {
  optional?: boolean;
  confirmationMessage?: string;
  default?: boolean;

}

interface StoredStep<Providers extends DefaultProviders> {
  name?: string;
  step: Step<Providers>;
  shouldRun: ShouldRunConfig;
  dependencies: StepDependency[];
  predefinedParams: PredefinedParameters;
}

interface StepDependency {
  sourceStep: string;
  exposedName: string;
  consumedName?: string;
  dontRunIfFalsy?: boolean;
  modifier?: (value: unknown) => string;
}

type PredefinedParameters = Record<string, unknown>;

const formatDependencies = (strings: string[]) => strings
  .map(s => `"${s}"`)
  .join(', ');

export class StepManager<Providers extends DefaultProviders> {
  protected steps: Array<StoredStep<Providers> | AtomicStepManager<Providers>> = [];

  protected namedSteps = new Map<string, StoredStep<Providers>>();

  protected exposedParams = new Map<string, Record<string, unknown>>();

  /**
   * A step is an incremental operation that updates the filesystem.
   */
  step(step: Step<Providers>, shouldRun: ShouldRunConfig = {}, dependencies: StepDependency[] = [], predefinedParams: PredefinedParameters = {}): this {
    this.validateDependencies(step, dependencies);

    this.steps = [...this.steps, { step, shouldRun, dependencies, predefinedParams }];

    return this;
  }

  namedStep(name: string, step: Step<Providers>, shouldRun: ShouldRunConfig = {}, dependencies: StepDependency[] = [], predefinedParams: PredefinedParameters = {}): this {
    if (this.namedSteps.has(name)) {
      throw new Error(`Named steps must have unique names. A step with name "${name}" already exists.`);
    }

    this.validateDependencies(step, dependencies);

    const newStep = { name, step, shouldRun, dependencies, predefinedParams };

    this.steps = [...this.steps, newStep];

    this.namedSteps.set(name, newStep);

    return this;
  }

  atomicGroup(callback: (stepManager: AtomicStepManager<Providers>) => void): this {
    const atomicCollection = new AtomicStepManager(this.namedSteps, this.exposedParams);

    callback(atomicCollection);

    this.steps = [...this.steps, atomicCollection];

    return this;
  }

  protected validateDependencies(step: Step<Providers>, dependencies: StepDependency[]): void {
    const missingDependencySteps = dependencies
      .map(dep => dep.sourceStep)
      .filter(stepName => !this.namedSteps.has(stepName));

    if (missingDependencySteps.length > 0) {
      throw new Error(`Step of type "${step.type}" depends on nonexistent named steps ${formatDependencies(missingDependencySteps)}`);
    }

    const missingDependencyParams: string[] = [];
    const missingDependencyParamSteps: string[] = [];

    for (const dependency of dependencies) {
      const sourceStep = this.namedSteps.get(dependency.sourceStep);

      if (!sourceStep?.step.exposes.includes(dependency.exposedName) && dependency.exposedName !== '__succeeded') {
        missingDependencyParamSteps.push(sourceStep?.name as string);
        missingDependencyParams.push(dependency.exposedName);
      }
    }

    if (missingDependencyParamSteps.length > 0) {
      throw new Error(`Step of type "${step.type}" depends on nonexistent exposed params ${formatDependencies(missingDependencyParams)} from named steps ${formatDependencies(missingDependencyParamSteps)}`);
    }
  }

  async run(paths: Paths, promptsIOFactory: IOFactory, providers: Providers): Promise<string[]> {
    const stepNames: string[] = [];

    for (let i = 0; i < this.steps.length; i++) {
      const storedStep = this.steps[i];

      if (storedStep instanceof AtomicStepManager) {
        const res = await storedStep.run(paths, promptsIOFactory, providers);
        stepNames.push(...res);
      } else {
        const shouldRun: boolean = await this.stepShouldRun(storedStep, promptsIOFactory);
        if (!shouldRun) continue;
        const fs = await this.runStep(storedStep, paths, promptsIOFactory, providers);

        await this.commit(fs);

        stepNames.push(storedStep.step.type);
      }
    }

    return stepNames;
  }

  protected async stepShouldRun(storedStep: StoredStep<Providers>, promptsIOFactory: IOFactory): Promise<boolean> {
    let allDependenciesRan = true;
    let noRequiredNonFalsyDependenciesAreFalsy = true;

    for (const dep of storedStep.dependencies) {
      if (!this.exposedParams.has(dep.sourceStep)) allDependenciesRan = false;
      const sourceDeps = this.exposedParams.get(dep.sourceStep);

      if (dep.exposedName !== '__succeeded' && dep.dontRunIfFalsy && !sourceDeps![dep.exposedName]) {
        noRequiredNonFalsyDependenciesAreFalsy = false;
      }
    }

    if (!allDependenciesRan || !noRequiredNonFalsyDependenciesAreFalsy) return false;

    if (!storedStep.shouldRun.optional) return true;

    const promptConfirm = await promptsIOFactory({ context: 'Confirm Step' }).getParam<boolean>({
      name: 'execute_step',
      message: storedStep.shouldRun.confirmationMessage || `Run step of type "${storedStep.step.type}"?`,
      initial: storedStep.shouldRun.default || false,
      type: 'confirm',
    });

    return promptConfirm;
  }

  protected async runStep(storedStep: StoredStep<Providers>, paths: Paths, promptsIOFactory: IOFactory, providers: Providers, fs: Store = createMemFs()): Promise<Store> {
    const initial: Record<string, unknown> = storedStep.dependencies.reduce((initial, dep) => {
      let depValue;
      depValue = dep.exposedName === '__succeeded' ? this.exposedParams.has(dep.sourceStep) : this.exposedParams.get(dep.sourceStep)![dep.exposedName];

      if (dep.modifier) {
        depValue = dep.modifier(depValue);
      }

      initial[dep.consumedName || dep.exposedName] = depValue;

      return initial;
    }, {} as Record<string, unknown>);

    const io = promptsIOFactory({ ...initial, ...storedStep.predefinedParams });

    const newFs = await storedStep.step.run(fs, paths, io, providers);

    if (storedStep.name) {
      this.exposedParams.set(storedStep.name, storedStep.step.getExposed(paths, io));
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

class AtomicStepManager<Providers> extends StepManager<Providers> {
  constructor(parentNamedSteps: Map<string, StoredStep<Providers>>, parentExposedParams: Map<string, Record<string, unknown>>) {
    super();
    this.namedSteps = parentNamedSteps;
    this.exposedParams = parentExposedParams;
  }

  step(step: Step<Providers>, shouldRun: ShouldRunConfig = {}, dependencies: StepDependency[] = [], predefinedParams: PredefinedParameters = {}): this {
    if (!step.composable) {
      throw new Error(`Step of type "${step.type}" is not composable, and cannot be added to an atomic group.`);
    }

    return super.step(step, shouldRun, dependencies, predefinedParams);
  }

  namedStep(name: string, step: Step<Providers>, shouldRun: ShouldRunConfig = {}, dependencies: StepDependency[] = [], predefinedParams: PredefinedParameters = {}): this {
    if (!step.composable) {
      throw new Error(`Step of type "${step.type}" is not composable, and cannot be added to an atomic group.`);
    }

    return super.namedStep(name, step, shouldRun, dependencies, predefinedParams);
  }

  atomicGroup(_callback: (stepManager: AtomicStepManager<Providers>) => void): this {
    throw new Error("Atomic groups can't be nested.");
  }

  async run(paths: Paths, promptsIOFactory: IOFactory, providers: Providers): Promise<string[]> {
    let fs = createMemFs();

    const stepNames: string[] = [];

    for (let i = 0; i < this.steps.length; i++) {
      const storedStep = this.steps[i] as StoredStep<Providers>;

      const shouldRun: boolean = await this.stepShouldRun(storedStep, promptsIOFactory);
      if (!shouldRun) continue;

      fs = await this.runStep(storedStep, paths, promptsIOFactory, providers, fs);

      stepNames.push(storedStep.step.type);
    }

    await this.commit(fs);

    return stepNames;
  }
}
