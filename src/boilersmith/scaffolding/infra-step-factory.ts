import { Store } from 'mem-fs';
import { IO } from 'boilersmith/io';
import { Paths } from '../paths';
import { Step } from '../step-manager';
import { applyModule, Module, ModuleStatusCache, promptModulesEnabled, setModuleValue } from './module';
import { promptParamValues, TemplateParam } from './template-param';

export function infraStepFactory<Providers extends {} = {}>(
  scaffoldDir: string,
  moduleName: string,
  modules: Module[],
  templateParams: TemplateParam[],
  moduleStatusCache?: ModuleStatusCache
): Step<Providers> {
  const module = modules.find(m => m.name === moduleName);
  if (!module) {
    throw new Error(`Module ${moduleName} not found`);
  }

  return {
    type: module.shortDescription,

    composable: true,

    async run(fs: Store, paths: Paths, io: IO, _providers: Providers): Promise<Store> {
      const paramVals = await promptParamValues(templateParams, paths, io);
      const modulesEnabled = await promptModulesEnabled(modules, io);

      applyModule(module, modulesEnabled, paramVals, scaffoldDir, fs, paths, false);

      if (moduleStatusCache) {
        setModuleValue(module, true, fs, paths, moduleStatusCache);
      }

      return fs;
    },

    exposes: [],

    getExposed(_paths: Paths, _paramProvider: IO): Record<string, unknown> {
      return {};
    },
  };
}
