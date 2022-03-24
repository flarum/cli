import chalk from 'chalk';
import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { resolve } from 'path';
import pick from 'pick-deep';
import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { readTpl } from 'boilersmith/utils/read-tpl';
import { cloneAndFill } from 'boilersmith/utils/clone-and-fill';
import { renameKeys } from 'boilersmith/utils/rename-keys';
import { condFormat } from 'boilersmith/utils/cond-format';
import { ExcludeScaffoldingFunc } from './scaffolder';

type FileOwnershipCommon<N extends string> = {
  /**
   * The path to the file
   */
  path: string;

  /**
   * Where the file should go. Defaults to path.
   */
  destPath?: string;

  /**
   * Depends on other modules being enabled (or disabled).
   */
  moduleDeps?: (N | { module: N; enabled: boolean })[];

  /**
   * Only create the file if it doesn't exist; do not update existing files.
   */
  doNotUpdate?: boolean;
};

type FileOwnership<N extends string> =
  | (FileOwnershipCommon<N> & {
      /**
       * If in a monorepo, should the file be placed relative to the monorepo root, and if so, where?
       * If provided, takes priority over destPath.
       */
      monorepoPath: string;

      /**
       * Only place this file if in a monorepo?
       */
      requireMonorepo: boolean;
    })
  | FileOwnershipCommon<N>;

interface CommonModule<N extends string> {
  name: N;

  shortDescription: string;

  longDescription?: string;

  /**
   * Whether files belonging to this module should be kept up to date.
   */
  updatable: boolean;

  /**
   * A list of scaffolding files managed by this module.
   */
  filesToReplace: (string | FileOwnership<N>)[];

  /**
   * A map of names of JSON files to keys which should be deep-merged from the scaffolding.
   */
  jsonToAugment: Record<string, string[]>;

  /**
   * An array of names of template params needed by this module.
   */
  needsTemplateParams: string[];
}

interface UntoggleableModule<N extends string> extends CommonModule<N> {
  /**
   * Whether this module can be enabled/disabled.
   */
  togglable: false;
}

interface TogglableModule<N extends string> extends CommonModule<N> {
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
  dependsOn: N[];

  /**
   * On an existing installation, if no information about whether this
   * module is enabled or disabled is cached, infer whether it's enabled
   * based on the current installation's state.
   */
  inferEnabled?: (fs: Store, paths: Paths) => Promise<boolean | undefined>;
}

export type Module<N extends string = string> = UntoggleableModule<N> | TogglableModule<N>;

export type ModuleStatusCache<N extends string> = {
  get: (module: Module<N>, fs: Store, paths: Paths) => Promise<boolean | undefined>;
  set: (module: Module<N>, val: boolean, fs: Store, paths: Paths) => Promise<void>;
};

export async function promptModulesEnabled<N extends string>(modules: Module<N>[], io: IO): Promise<Record<N, boolean>> {
  const modulesEnabled: Record<string, boolean> = {};

  const advanced = await io.getParam({
    name: 'advancedInstallation',
    type: 'confirm',
    initial: false,
    message: `Advanced Initialization ${condFormat(io.supportsAnsiColor, chalk.dim, '(fine-tune which features are enabled)')}`,
  });

  for (const m of modules) {
    const missingDeps = !m.togglable || m.dependsOn.some((dep) => !modulesEnabled[dep]);
    if (!m.togglable) {
      modulesEnabled[m.name] = true;
    } else if (missingDeps) {
      modulesEnabled[m.name] = false;
    } else if (advanced) {
      // eslint-disable-next-line no-await-in-loop
      modulesEnabled[m.name] = await io.getParam({
        name: `modules.${m.name}`,
        type: 'confirm',
        initial: m.defaultEnabled,
        message: m.shortDescription + (m.longDescription ? condFormat(io.supportsAnsiColor, chalk.dim, ` (${m.longDescription})`) : ''),
      });
    } else {
      modulesEnabled[m.name] = m.defaultEnabled;
    }
  }

  return modulesEnabled;
}

export async function currModulesEnabled<N extends string>(
  modules: Module<N>[],
  fs: Store,
  paths: Paths,
  cache?: ModuleStatusCache<N>
): Promise<Record<N, boolean>> {
  const modulesEnabled: Record<string, boolean> = {};

  for (const m of modules) {
    if (m.togglable) {
      // eslint-disable-next-line no-await-in-loop
      const isEnabled = (await cache?.get(m, fs, paths)) ?? (await m.inferEnabled?.(fs, paths));

      modulesEnabled[m.name] = isEnabled ?? m.defaultEnabled;
    } else {
      modulesEnabled[m.name] = true;
    }
  }

  return modulesEnabled;
}

export async function setModuleValue<MN extends string>(
  module: Module<MN>,
  enabled: boolean,
  fs: Store,
  paths: Paths,
  cache: ModuleStatusCache<MN>
): Promise<void> {
  if (module.togglable) {
    cache.set(module, enabled, fs, paths);
  }
}

// eslint-disable-next-line max-params,complexity
export async function applyModule<MN extends string, TN extends string>(
  module: Module<MN>,
  modulesEnabled: Record<string, boolean>,
  paramVals: Record<TN, unknown>,
  scaffoldDir: string,
  fs: Store,
  paths: Paths,
  // eslint-disable-next-line unicorn/no-object-as-default-parameter
  excludeScaffolding: ReturnType<ExcludeScaffoldingFunc> = { files: [], configKeys: {} },
  isInitial = false
): Promise<Store> {
  const fsEditor = create(fs);

  // Validate that module can be enabled
  if (!modulesEnabled?.[module.name]) {
    throw new Error(`Could not apply module "${module.name}", because it is not enabled in the provided module statuses.`);
  }

  // Validate that dependencies are enabled
  const missingDeps = module.togglable ? module.dependsOn.filter((dep) => !modulesEnabled[dep]) : [];
  if (missingDeps.length > 0) {
    throw new Error(`Could not apply module "${module.name}", because the following dependency modules are missing: "${missingDeps.join(', ')}".`);
  }

  // Validate that all needed params are present
  const missingParams = module.needsTemplateParams.filter((p) => !(p in paramVals));
  if (missingParams.length > 0) {
    throw new Error(`Could not apply module "${module.name}", because the following params are missing: "${missingParams.join(', ')}".`);
  }

  if (!isInitial && !module.updatable) {
    throw new Error(`Cannot update module "${module.name}", as it is not updatable, and has already been initialized.`);
  }

  const tplData = {
    params: paramVals,
    modules: modulesEnabled,
  };

  const tplDataFlat = { ...renameKeys(tplData.modules, (k) => `modules.${k}`), ...renameKeys(tplData.params, (k) => `params.${k}`) } as Record<
    string,
    string
  >;

  // This is necessary because one layer of escaped backslashes is lost on template population.
  tplData.params = Object.fromEntries(Object.entries(paramVals).map(([k, v]) => [k, typeof v === 'string' ? v.replace('\\', '\\\\') : v])) as Record<
    TN,
    unknown
  >;

  for (const file of module.filesToReplace) {
    const path = typeof file === 'string' ? file : file.path;
    const moduleDeps = typeof file === 'string' ? [] : file.moduleDeps ?? [];

    const copyToIfMonorepo =
      typeof file !== 'string' && 'monorepoPath' in file && file.monorepoPath
        ? paths.monorepo(cloneAndFill(file.monorepoPath, tplDataFlat))
        : undefined;
    const copyTo = copyToIfMonorepo ?? paths.package(typeof file !== 'string' && file.destPath ? cloneAndFill(file.destPath, tplDataFlat) : path);

    if (typeof file !== 'string' && file.doNotUpdate && fsEditor.exists(copyTo)) {
      continue;
    }

    if (typeof file !== 'string' && 'requireMonorepo' in file && file.requireMonorepo && paths.monorepo() === null) {
      continue;
    }

    if (
      excludeScaffolding.files.includes(path) ||
      moduleDeps.some((dep) => {
        const depName = typeof dep === 'string' ? dep : dep.module;
        const enabled = modulesEnabled[depName];
        return typeof dep === 'string' || dep.enabled ? !enabled : enabled;
      })
    ) {
      continue;
    }

    let source = readTpl(resolve(scaffoldDir, path), tplData);

    if (fsEditor.exists(copyTo)) {
      source = applyCustomizations(source, fsEditor.read(copyTo));
    }

    fsEditor.write(copyTo, source);
  }

  const jsonPaths = cloneAndFill(module.jsonToAugment, tplDataFlat);
  for (const jsonPath of Object.keys(jsonPaths)) {
    const scaffoldContents = readTpl(resolve(scaffoldDir, jsonPath), tplData);
    const scaffoldContentsJson = JSON.parse(scaffoldContents);

    const excludeKeys = cloneAndFill(excludeScaffolding.configKeys[jsonPath] ?? [], tplDataFlat);
    const fieldsToAugment = jsonPaths[jsonPath].filter((key) => !excludeKeys.includes(key));
    const relevant = pick(scaffoldContentsJson, fieldsToAugment);

    fsEditor.extendJSON(paths.package(jsonPath), relevant, undefined, 4);
  }

  return fs;
}

function applyCustomizations(source: string, curr: string): string {
  const commentStructures = [
    ['//', '\n'],
    ['/*', ' */'],
    ['<!--', '-->'],
    ['#', '\n'],
  ] as [string, string][];

  commentStructures.forEach((x) => x);

  return commentStructures.reduce((acc, [start, end]) => {
    const CUSTOMIZATION_REGEX = new RegExp(
      `(${start}\\s*<CUSTOM-(?<id>.*)>\\s*${end})(?<contents>.*)(${start}\\s*</CUSTOM-\\k<id>>\\s*${end})`,
      'gs'
    );

    const matches = curr.matchAll(CUSTOMIZATION_REGEX);
    const customizations = Object.fromEntries(
      [...matches]
        .map((m) => m.groups)
        .filter(Boolean)
        .map((g) => [g?.id, g?.contents])
    );

    return acc.replace(
      CUSTOMIZATION_REGEX,
      (_m, open, id, _c, close) =>
        (console.log(`${open}${customizations[id] ?? ''}${close}`, '\n' + customizations[id]) as any as string) ||
        `${open}${customizations[id] ?? ''}${close}`
    );
  }, source);
}
