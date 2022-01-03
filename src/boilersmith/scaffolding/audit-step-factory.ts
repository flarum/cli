import { create, Store } from 'mem-fs';
import { IO } from 'boilersmith/io';
import { Paths } from '../paths';
import { DefaultProviders, Step } from '../step-manager';
import { renameKeys } from '../utils/rename-keys';
import { applyModule, currModulesEnabled, Module, ModuleStatusCache } from './module';
import { currParamValues, TemplateParam } from './template-param';
import { ExcludeScaffoldingFunc } from './scaffolder';

export function auditStepFactory<MN extends string, Providers extends DefaultProviders>(dry: boolean, scaffoldDir: string, modules: Module<MN>[], templateParams: TemplateParam[], excludeScaffoldingFunc?: ExcludeScaffoldingFunc, moduleStatusCache?: ModuleStatusCache<MN>): Step<Providers> {
  let modulesEnabled: Record<string, boolean>;

  return {
    type: 'Audit for outdated infrastructure files or config.',

    composable: true,

    async run<Providers>(_fs: Store, paths: Paths, io: IO, _providers: Providers): Promise<Store> {
      const paramVals = await currParamValues(templateParams, _fs, paths, io);
      modulesEnabled = await currModulesEnabled(modules, _fs, paths, moduleStatusCache);

      for (const m of modules) {
        if (m.updatable && modulesEnabled[m.name] && (!m.togglable || !m.dependsOn.some(dep => !modulesEnabled[dep]))) {
          const fs = dry ? create() : _fs;
          const excludeScaffolding = excludeScaffoldingFunc ? excludeScaffoldingFunc(fs, paths) : [];
          applyModule(m, modulesEnabled, paramVals, scaffoldDir, fs, paths, excludeScaffolding, true);
          if (fs.all()) {
            io.error(m.name + ' ' + JSON.stringify(fs.all().map(f => [f.path, f.state])), false);
          }
        }
      }

      return _fs;
    },

    exposes: modules.map(m => `modules.${m.name}`),

    getExposed(_paths: Paths, _paramProvider: IO): Record<string, unknown> {
      return renameKeys(modulesEnabled, k => `modules.${k}`);
    },
  };
}
