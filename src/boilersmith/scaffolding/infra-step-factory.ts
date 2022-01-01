import { Store } from 'mem-fs';
import { IO } from 'boilersmith/io';
import { Paths } from '../paths';
import { Step } from '../step-manager';
import { applyModule, Module, ModuleStatusCache, promptModulesEnabled, setModuleValue } from './module';
import { promptParamValues, TemplateParam } from './template-param';

export function infraStepFactory<MN extends string, Providers extends {} = {}>(
  scaffoldDir: string,
  moduleName: string,
  modules: Module<MN>[],
  templateParams: TemplateParam[],
  moduleStatusCache?: ModuleStatusCache<MN>
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

      const initializing = !modulesEnabled[module.name];
      applyModule(module, modulesEnabled, paramVals, scaffoldDir, fs, paths, initializing);

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
