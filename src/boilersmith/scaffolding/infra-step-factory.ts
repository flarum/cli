import { Store } from 'mem-fs';
import { IO } from 'boilersmith/io';
import { Paths } from '../paths';
import { DefaultProviders, Step } from '../step-manager';
import { applyModule, currModulesEnabled, Module, ModuleStatusCache, setModuleValue } from './module';
import { currParamValues, TemplateParam } from './template-param';
import { ExcludeScaffoldingFunc } from './scaffolder';

export function infraStepFactory<MN extends string, Providers extends DefaultProviders>(
  scaffoldDir: string,
  moduleName: string,
  modules: Module<MN>[],
  templateParams: TemplateParam[],
  excludeScaffoldingFunc?: ExcludeScaffoldingFunc,
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
        io.error(`${module.name} is not updatable.`, true);
      }

      const excludeScaffolding = excludeScaffoldingFunc ? excludeScaffoldingFunc(fs, paths) : [];

      const initializing = !modulesEnabled[module.name];
      applyModule(module, {...modulesEnabled, [module.name]: true}, paramVals, scaffoldDir, fs, paths, excludeScaffolding, initializing);

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
