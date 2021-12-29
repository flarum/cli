import globby from 'globby';
import { Store } from 'mem-fs';
import { resolve } from 'path';
import { PathProvider } from 'src/provider/path-provider';
import { jsonLeafPaths } from '../../src/utils/json-leaf-paths';
import { readTpl } from '../../src/utils/read-tpl';
import { Module } from './module';
import { currParamValues, getParamName, isComputedParam, TemplateParam } from './template-param';


export class Scaffolder {
  private templateParams: TemplateParam<unknown>[] = [];
  private modules: Module[] = [];
  private scaffoldDir: string;

  constructor(scaffoldDir: string) {
    this.scaffoldDir = scaffoldDir;
  }

  registerModule(module: Module): this {
    this.modules.push(module);

    return this;
  }

  registerTemplateParam<T>(templateParam: TemplateParam<T>): this {
    if (isComputedParam(templateParam)) {
      const currParams = new Set(this.templateParams.map(p => getParamName(p)));
      const missingDeps = templateParam.uses.filter(dep => !currParams.has(dep))

      if (missingDeps.length) {
        throw new Error(`Computed template param "${getParamName(templateParam)}" is missing dependency params: "${missingDeps.join(', ')}".`);
      }
    }


    this.templateParams.push(templateParam);

    return this;
  }

  async templateParamVals(fs: Store, pathProvider: PathProvider) {
    return currParamValues(this.templateParams, fs, pathProvider);
  }

  /**
   * Confirm that all files and configuration keys in the scaffolding dir
   * are owned by at least one module, and that no modules own nonexistent
   * files or configuration keys.
   */
  async validate() {
    const errors: string[] = [];

    const filesToOwnerModules = new Map<string, string[]>();
    const configKeysToOwnerModules = new Map<string, { fileOwners: string[]; keyOwners: Map<string, string[]> }>();
    const templateParamsToUsingModules = new Map<string, string[]>();

    for (const module of this.modules) {
      module.filesToReplace.forEach((file) => {
        const path = typeof file === 'string' ? file : file.path;

        const currModules = filesToOwnerModules.get(path) ?? [];
        filesToOwnerModules.set(path, [...currModules, module.name]);
      });

      module.needsTemplateParams.forEach((paramName) => {
        const currModules = filesToOwnerModules.get(paramName) ?? [];
        templateParamsToUsingModules.set(paramName, [...currModules, module.name]);
      });

      Object.keys(module.jsonToAugment).forEach((jsonPath) => {
        const ownedKeys = module.jsonToAugment[jsonPath];

        const currJsonData = configKeysToOwnerModules.get(jsonPath) ?? { fileOwners: [], keyOwners: new Map<string, string[]>() };

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

    // Generate template data for future checks
    const tplData: Record<string, ''> = this.templateParams.reduce((acc, param) => {
      return { ...acc, [getParamName(param)]: '' };
    }, {});

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
        if (errors.length) {
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
        } catch (e) {
          if (e instanceof SyntaxError) {
            errors.push(`File "${path}" is invalid JSON: ${e.message}`);
          } else {
            errors.push(String(e));
          }
        }
      });

    // Flush pending errors again, as if we run into problems during `readTpl`,
    // we won't be able to express other errors.
    if (errors.length) {
      throw new Error(errors.join('\n'));
    }

    // Ensure that all files can be resolved with ejs using provided template variables.
    scaffoldingFilePaths.forEach((path) => {
      readTpl(resolve(this.scaffoldDir, path), tplData);
    });
  }
}
