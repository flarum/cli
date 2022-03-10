import globby from 'globby';
import { Store } from 'mem-fs';
import { resolve } from 'path';
import { Paths } from '../paths';
import { DefaultProviders, Step } from '../step-manager';
import { jsonLeafPaths } from 'boilersmith/utils/json-leaf-paths';
import { readTpl } from 'boilersmith/utils/read-tpl';
import { initStepFactory } from './init-step-factory';
import { currModulesEnabled, Module, ModuleStatusCache } from './module';
import { currParamValues, getParamName, isComputedParam, TemplateParam } from './template-param';
import { infraStepFactory } from './infra-step-factory';
import { renameKeys } from 'boilersmith/utils/rename-keys';
import { cloneAndFill } from 'boilersmith/utils/clone-and-fill';
import { IO } from 'boilersmith/io';
import { auditStepFactory } from './audit-step-factory';

export type ExcludeScaffoldingFunc = (
  fs: Store,
  paths: Paths
) => {
  files: string[];
  configKeys: Record<string, string[]>;
};

export class Scaffolder<TN extends string = string, MN extends string = string> {
  private templateParams: TemplateParam<unknown, TN>[] = [];
  private modules: Module<MN>[] = [];
  private scaffoldDir: string;

  private moduleStatusCache?: ModuleStatusCache<MN>;
  private excludeScaffoldingFunc?: ExcludeScaffoldingFunc;

  constructor(scaffoldDir: string);
  constructor(scaffoldDir: string, moduleStatusCache: ModuleStatusCache<MN>);
  constructor(scaffoldDir: string, moduleStatusCache: ModuleStatusCache<MN>, excludeScaffoldingFuncs: ExcludeScaffoldingFunc);

  constructor(scaffoldDir: string, moduleStatusCache?: ModuleStatusCache<MN>, excludeScaffoldingFunc?: ExcludeScaffoldingFunc) {
    this.scaffoldDir = scaffoldDir;
    this.moduleStatusCache = moduleStatusCache;
    this.excludeScaffoldingFunc = excludeScaffoldingFunc;
  }

  registerModule(module: Module<MN>): this {
    this.modules.push(module);

    return this;
  }

  registerTemplateParam<T>(templateParam: TemplateParam<T, TN>): this {
    if (isComputedParam(templateParam)) {
      const currParams = new Set(this.templateParams.map((p) => getParamName(p)));
      const missingDeps = templateParam.uses.filter((dep) => !currParams.has(dep as TN));

      if (missingDeps.length > 0) {
        throw new Error(`Computed template param "${getParamName(templateParam)}" is missing dependency params: "${missingDeps.join(', ')}".`);
      }
    }

    this.templateParams.push(templateParam);

    return this;
  }

  genInitStep<Providers extends DefaultProviders>(): Step<Providers> {
    return initStepFactory(this.scaffoldDir, this.modules, this.templateParams, this.excludeScaffoldingFunc, this.moduleStatusCache);
  }

  genInfraStep<Providers extends DefaultProviders>(module: string): Step<Providers> {
    return infraStepFactory(this.scaffoldDir, module, this.modules, this.templateParams, this.excludeScaffoldingFunc, this.moduleStatusCache);
  }

  genAuditStep<Providers extends DefaultProviders>(dry = true): Step<Providers> {
    return auditStepFactory(dry, this.scaffoldDir, this.modules, this.templateParams, this.excludeScaffoldingFunc, this.moduleStatusCache);
  }

  async templateParamVal<T>(param: TN, fs: Store, paths: Paths, io: IO): Promise<T> {
    return (await currParamValues(this.templateParams, fs, paths, io))[param] as T;
  }

  async templateParamVals(fs: Store, paths: Paths, io: IO): Promise<Record<TN, unknown>> {
    return currParamValues(this.templateParams, fs, paths, io);
  }

  async modulesEnabled(fs: Store, paths: Paths): Promise<Record<MN, boolean>> {
    return currModulesEnabled<MN>(this.modules, fs, paths, this.moduleStatusCache);
  }

  moduleFiles(moduleName: MN): string[] {
    return this.modules.find((m) => m.name === moduleName)?.filesToReplace.map((f) => (typeof f === 'string' ? f : f.path)) ?? [];
  }

  /**
   * Confirm that all files and configuration keys in the scaffolding dir
   * are owned by at least one module, and that no modules own nonexistent
   * files or configuration keys.
   */
  async validate(): Promise<void> {
    const errors: string[] = [];

    // Generate template data for future checks
    const paramVals: Record<string, 'TEST'> = Object.fromEntries(this.templateParams.map((param) => [getParamName(param), 'TEST']));

    const modulesEnabled: Record<string, boolean> = Object.fromEntries(this.modules.map((module) => [module.name, true]));

    const tplData = { params: paramVals, modules: modulesEnabled };
    const tplDataFlat = { ...renameKeys(tplData.modules, (k) => `modules.${k}`), ...renameKeys(tplData.params, (k) => `params.${k}`) } as Record<
      string,
      string
    >;

    const moduleNames = new Set(this.modules.map((m) => m.name));
    for (const module of this.modules) {
      const missingDeps = module.togglable ? module.dependsOn.filter((dep) => !moduleNames.has(dep as MN)) : [];
      if (missingDeps.length > 0) {
        errors.push(`Module "${module.name}" depends on modules that are not registered: "${missingDeps.join(', ')}".`);
      }
    }

    const filesToOwnerModules = new Map<string, MN[]>();
    const configKeysToOwnerModules = new Map<string, { fileOwners: MN[]; keyOwners: Map<string, MN[]> }>();
    const templateParamsToUsingModules = new Map<TN, MN[]>();

    for (const module of this.modules) {
      module.filesToReplace.forEach((file) => {
        const path = typeof file === 'string' ? file : file.path;

        const currModules = filesToOwnerModules.get(path) ?? [];
        filesToOwnerModules.set(path, [...currModules, module.name]);
      });

      module.needsTemplateParams.forEach((paramName) => {
        const currModules = filesToOwnerModules.get(paramName) ?? [];
        templateParamsToUsingModules.set(paramName as TN, [...currModules, module.name]);
      });

      Object.keys(module.jsonToAugment).forEach((jsonPath) => {
        const ownedKeys = cloneAndFill(module.jsonToAugment, tplDataFlat)[jsonPath];

        const currJsonData = configKeysToOwnerModules.get(jsonPath) ?? { fileOwners: [], keyOwners: new Map<string, MN[]>() };

        currJsonData.fileOwners.push(module.name);

        ownedKeys.forEach((key) => {
          const currModules = currJsonData.keyOwners.get(key) ?? [];
          currJsonData.keyOwners.set(key, [...currModules, module.name]);
        });

        configKeysToOwnerModules.set(jsonPath, currJsonData);
      });
    }

    // Ensure that there's no interesection between owned regular files and files with owned JSON keys.
    const moduleOwnedFiles = [...filesToOwnerModules.keys()];
    const moduleOwnedJsonConfs = new Set(configKeysToOwnerModules.keys());
    moduleOwnedFiles
      .filter((path) => moduleOwnedJsonConfs.has(path))
      .forEach((path) => {
        const fileModules = filesToOwnerModules.get(path)?.join(', ');
        const keyModules = configKeysToOwnerModules.get(path)?.fileOwners.join(', ');
        errors.push(`File "${path}" is owned by modules: "${fileModules}". However, it also has keys that are owned by modules: "${keyModules}".`);
      });

    // Ensure that all owned files exist in the filesystem.
    const scaffoldingFilePaths = new Set(
      (await globby(resolve(this.scaffoldDir, '**/*'), { dot: true })).map((p) => p.replace(`${this.scaffoldDir}/`, '')).filter((p) => p !== '')
    );

    moduleOwnedFiles
      .filter((path) => !scaffoldingFilePaths.has(path))
      .forEach((path) => {
        const fileModules = filesToOwnerModules.get(path)?.join(', ');
        errors.push(`File "${path}" is owned by modules: "${fileModules}", but it doesn't exist in the scaffolding directory.`);
      });

    [...moduleOwnedJsonConfs]
      .filter((path) => !scaffoldingFilePaths.has(path))
      .forEach((path) => {
        const keyModules = configKeysToOwnerModules.get(path)?.fileOwners.join(', ');
        errors.push(`File "${path}" has keys owned by modules: "${keyModules}", but it doesn't exist in the scaffolding directory.`);
      });

    // Ensure that all files in the filesystem are owned by at least one module.
    [...scaffoldingFilePaths]
      .filter((path) => !filesToOwnerModules.has(path) && !configKeysToOwnerModules.has(path))
      .forEach((path) => {
        errors.push(`File "${path}" is not owned by any module.`);
      });

    // Ensure that every template param is used by at least one module.
    this.templateParams
      .filter((p) => !templateParamsToUsingModules.has(getParamName(p)))
      .forEach((p) => {
        errors.push(`Template param "${getParamName(p)}" is defined, but not used by any modules.`);
      });

    // Ensure that every module's needed template params are provided.
    const providedParams = new Set(this.templateParams.map((p) => getParamName(p)));
    [...templateParamsToUsingModules.keys()]
      .filter((paramName) => !providedParams.has(paramName))
      .forEach((paramName) => {
        const paramModules = templateParamsToUsingModules.get(paramName)?.join(', ');
        errors.push(`Template param "${paramName}" is used by modules: "${paramModules}", but is not provided.`);
      });

    // Ensure that for owned JSON files, all keys are owned by at least one module.
    [...configKeysToOwnerModules.entries()]
      .filter(([path]) => scaffoldingFilePaths.has(path))
      .forEach(([path, ownerData]) => {
        // Flush pending errors before readTpl calls, because
        // if that fails due to templating syntax issues, no other
        // errors will be shared, and those other errors commonly
        // are the cause of template errors (e.g. missing params).
        if (errors.length > 0) {
          throw new Error(errors.join('\n'));
        }

        const contents = readTpl(resolve(this.scaffoldDir, path), tplData);

        let json;
        try {
          json = JSON.parse(contents);
          const keys = new Set(jsonLeafPaths(json));

          [...keys]
            .filter((k) => !ownerData.keyOwners.has(k))
            .forEach((k) => {
              errors.push(`Key "${k}" in file "${path}" is not owned by any module.`);
            });

          [...ownerData.keyOwners.entries()]
            .filter(([k]) => !keys.has(k))
            .forEach(([k, owners]) => {
              errors.push(`Key "${k}" is owned by modules: "${owners.join(', ')}", but does not exist in file "${path}".`);
            });
        } catch (error) {
          if (error instanceof SyntaxError) {
            errors.push(`File "${path}" is invalid JSON: ${error.message}`);
          } else {
            errors.push(String(error));
          }
        }
      });

    // Flush pending errors again, as if we run into problems during `readTpl`,
    // we won't be able to express other errors.
    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    }

    // Ensure that all files can be resolved with ejs using provided template variables.
    scaffoldingFilePaths.forEach((path) => {
      readTpl(resolve(this.scaffoldDir, path), tplData);
    });
  }
}
