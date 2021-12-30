import chalk from 'chalk';
import { Store } from 'mem-fs';
import { ParamProvider } from 'src/provider/param-provider';
import { PathProvider } from 'src/provider/path-provider';

interface FileOwnership {
  /**
   * The path to the file
   */
  path: string;

  /**
   * If any of the needed modules aren't enabled, the file won't be updated.
   */
  needsOneOfModules?: string[];
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
  get: (module: string, fs: Store, pathProvider: PathProvider) => Promise<boolean | undefined>;
  set: (module: string, val: boolean, fs: Store, pathProvider: PathProvider) => Promise<void>;
};

export async function promptModulesEnabled(modules: Module[], promptProvider: ParamProvider): Promise<Record<string, boolean>> {
  const modulesEnabled: Record<string, boolean> = {};

  const advanced = await promptProvider.get<boolean>({
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
      modulesEnabled[m.name] = await promptProvider.get<boolean>({
        name: m.name,
        type: 'confirm',
        initial: m.defaultEnabled,
        message: m.shortDescription + (m.longDescription ? chalk.dim(` (${m.longDescription})`) : ''),
      });
    }
  }

  return modulesEnabled;
}

export async function currModulesEnabled(modules: Module[], fs: Store, pathProvider: PathProvider, cache?: ModuleStatusCache): Promise<Record<string, boolean>> {
  const modulesEnabled: Record<string, boolean> = {};

  for (const m of modules) {
    if (!m.togglable) {
      modulesEnabled[m.name] = true;
    } else {
      const cacheVal = await cache?.get(m.name, fs, pathProvider);

      modulesEnabled[m.name] = cacheVal ?? m.defaultEnabled;
    }
  }

  return modulesEnabled;
}

export async function setModuleValues(modules: Module[], moduleStatuses: Record<string, boolean>, fs: Store, pathProvider: PathProvider, cache: ModuleStatusCache): Promise<void> {
  for (const m of modules) {
    if (m.togglable) {
      cache.set(m.name, moduleStatuses[m.name], fs, pathProvider);
    }
  }
}
