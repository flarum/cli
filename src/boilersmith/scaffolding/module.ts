import chalk from 'chalk';
import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { resolve } from 'path';
import pick from 'pick-deep';
import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { readTpl } from 'boilersmith/utils/read-tpl';

interface FileOwnership {
  /**
   * The path to the file
   */
  path: string;

  /**
   * If any of the needed modules aren't enabled, the file won't be updated.
   */
  needsOtherModules?: string[];
}

interface CommonModule {
  name: string;

  shortDescription: string;

  longDescription?: string;

  /**
   * Whether files belonging to this module should be kept up to date.
   */
  updatable: boolean;

  /**
   * A list of scaffolding files managed by this module.
   */
  filesToReplace: (string | FileOwnership)[];

  /**
   * A map of names of JSON files to keys which should be deep-merged from the scaffolding.
   */
  jsonToAugment: Record<string, string[]>;

  /**
   * An array of names of template params needed by this module.
   */
  needsTemplateParams: string[];
}

interface UntoggleableModule extends CommonModule {
  /**
   * Whether this module can be enabled/disabled.
   */
  togglable: false;
}

interface TogglableModule extends CommonModule {
  /**
   * Whether this module can be enabled/disabled.
   */
  togglable: true;

  /**
   * Whether this module is enabled or disabled by default.
   */
  defaultEnabled: boolean;

  /**
   * Can only be enabled if these other modules are enabled.
   */
  dependsOn: string[];
}

export type Module = UntoggleableModule | TogglableModule;

export type ModuleStatusCache = {
  get: (module: string, fs: Store, paths: Paths) => Promise<boolean | undefined>;
  set: (module: string, val: boolean, fs: Store, paths: Paths) => Promise<void>;
};

export async function promptModulesEnabled(modules: Module[], promptProvider: IO): Promise<Record<string, boolean>> {
  const modulesEnabled: Record<string, boolean> = {};

  const advanced = await promptProvider.getParam<boolean>({
    name: 'advancedInstallation',
    type: 'confirm',
    initial: false,
    message: `Advanced Initialization ${chalk.dim('(fine-tune which features are enabled)')}`,
  });

  for (const m of modules) {
    if (!m.togglable) {
      modulesEnabled[m.name] = true;
    } else if (!advanced) {
      modulesEnabled[m.name] = m.defaultEnabled;
    } else {
      modulesEnabled[m.name] = await promptProvider.getParam<boolean>({
        name: m.name,
        type: 'confirm',
        initial: m.defaultEnabled,
        message: m.shortDescription + (m.longDescription ? chalk.dim(` (${m.longDescription})`) : ''),
      });
    }
  }

  return modulesEnabled;
}

export async function currModulesEnabled(
  modules: Module[],
  fs: Store,
  paths: Paths,
  cache?: ModuleStatusCache
): Promise<Record<string, boolean>> {
  const modulesEnabled: Record<string, boolean> = {};

  for (const m of modules) {
    if (!m.togglable) {
      modulesEnabled[m.name] = true;
    } else {
      const cacheVal = await cache?.get(m.name, fs, paths);

      modulesEnabled[m.name] = cacheVal ?? m.defaultEnabled;
    }
  }

  return modulesEnabled;
}

export async function setModuleValue(module: Module, enabled: boolean, fs: Store, paths: Paths, cache: ModuleStatusCache): Promise<void> {
  if (module.togglable) {
    cache.set(module.name, enabled, fs, paths);
  }
}

export async function applyModule(
  module: Module,
  modulesEnabled: Record<string, boolean>,
  paramVals: Record<string, unknown>,
  scaffoldDir: string,
  fs: Store,
  paths: Paths,
  isInitial = false
): Promise<Store> {
  const fsEditor = create(fs);

  // Validate that module can be enabled
  if (!modulesEnabled?.[module.name]) {
    throw new Error(`Could not apply module "${module.name}", because it is not enabled in the provided module statuses.`);
  }

  // Validate that dependencies are enabled
  const missingDeps = module.togglable ? module.dependsOn.filter((dep) => !modulesEnabled[dep]) : [];
  if (missingDeps.length) {
    throw new Error(`Could not apply module "${module.name}", because the following dependency modules are missing: "${missingDeps.join(', ')}".`);
  }

  // Validate that all needed params are present
  const missingParams = module.needsTemplateParams.filter((p) => !(p in paramVals));
  if (missingParams.length) {
    throw new Error(`Could not apply module "${module.name}", because the following params are missing: "${missingParams.join(', ')}".`);
  }

  if (!isInitial && !module.updatable) {
    throw new Error(`Cannot update module "${module.name}", as it is not updatable, and the project has already been initialized.`);
  }

  const tplData = {
    params: paramVals,
    modules: modulesEnabled,
  };

  for (const file of module.filesToReplace) {
    const path = typeof file === 'string' ? file : file.path;
    const needsOtherModules = typeof file === 'string' ? [] : file.needsOtherModules ?? [];

    if (!needsOtherModules.some((dep) => !modulesEnabled[dep])) {
      fsEditor.copyTpl(resolve(scaffoldDir, path), paths.package(path), tplData);
    }
  }

  for (const jsonPath of Object.keys(module.jsonToAugment)) {
    const scaffoldContents = readTpl(resolve(scaffoldDir, jsonPath), tplData);
    const scaffoldContentsJson = JSON.parse(scaffoldContents);

    const fieldsToAugment = module.jsonToAugment[jsonPath];
    const relevant = pick(scaffoldContentsJson, fieldsToAugment);

    fsEditor.extendJSON(paths.package(jsonPath), relevant);
  }

  return fs;
}
