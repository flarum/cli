import { Store } from 'mem-fs';
import { IO } from 'boilersmith/io';
import { Paths } from '../paths';
import { Step } from '../step-manager';
import { renameKeys } from '../utils/rename-keys';
import { applyModule, Module, ModuleStatusCache, promptModulesEnabled, setModuleValue } from './module';
import { promptParamValues, TemplateParam } from './template-param';

export function initStepFactory<MN extends string, Providers extends {} = {}>(scaffoldDir: string, modules: Module<MN>[], templateParams: TemplateParam[], moduleStatusCache?: ModuleStatusCache<MN>): Step<Providers> {
  let modulesEnabled: Record<string, boolean>;

  return {
    type: 'Generate package skeleton',

    composable: true,

    async run<Providers>(fs: Store, paths: Paths, io: IO, _providers: Providers): Promise<Store> {
      const paramVals = await promptParamValues(templateParams, paths, io);
      modulesEnabled = await promptModulesEnabled(modules, io);

      for (const m of modules) {
        if (modulesEnabled[m.name] && (!m.togglable || !m.dependsOn.some(dep => !modulesEnabled[dep]))) {
          applyModule(m, modulesEnabled, paramVals, scaffoldDir, fs, paths, true);
        }
      }

      if (moduleStatusCache) {
        modules.forEach(m => {
          setModuleValue(m, modulesEnabled[m.name], fs, paths, moduleStatusCache);
        });
      }

      return fs;
    },

    exposes: modules.map((m) => `modules.${m.name}`),

    getExposed(_paths: Paths, _paramProvider: IO): Record<string, unknown> {
      return renameKeys(modulesEnabled, k => `modules.${k}`);
    },
  };
}
