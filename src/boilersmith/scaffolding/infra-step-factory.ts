import { Store } from 'mem-fs';
import { IO } from 'boilersmith/io';
import { Paths } from '../paths';
import { DefaultProviders, Step } from '../step-manager';
import { applyModule, currModulesEnabled, Module, ModuleStatusCache, setModuleValue } from './module';
import { currParamValues, TemplateParam } from './template-param';

export function infraStepFactory<MN extends string, Providers extends DefaultProviders>(
  scaffoldDir: string,
  moduleName: string,
  modules: Module<MN>[],
  templateParams: TemplateParam[],
  moduleStatusCache?: ModuleStatusCache<MN>,
): Step<Providers> {
  const module = modules.find(m => m.name === moduleName);
  if (!module) {
    throw new Error(`Module ${moduleName} not found`);
  }

  return {
    type: module.shortDescription,

    composable: true,

    async run(fs: Store, paths: Paths, io: IO, _providers: Providers): Promise<Store> {
      const paramVals = await currParamValues(templateParams, fs, paths, io);
      const modulesEnabled = await currModulesEnabled(modules, fs, paths, moduleStatusCache);

      if (!module.updatable) {
        io.error(`${module.name} is not updatable.`, true, true);
      }

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
