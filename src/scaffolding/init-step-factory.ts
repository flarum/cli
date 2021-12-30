import { Store } from 'mem-fs';
import { ParamProvider } from '../../src/provider/param-provider';
import { PathProvider } from '../../src/provider/path-provider';
import { PhpProvider } from '../../src/provider/php-provider';
import { Step } from '../../src/steps/step-manager';
import { renameKeys } from '../../src/utils/rename-keys';
import { applyModule, Module, ModuleStatusCache, promptModulesEnabled, setModuleValue } from './module';
import { promptParamValues, TemplateParam } from './template-param';

export function initStepFactory(scaffoldDir: string, modules: Module[], templateParams: TemplateParam<unknown>[], moduleStatusCache?: ModuleStatusCache): Step {
  let modulesEnabled: Record<string, boolean>;

  return {
    type: 'Generate package skeleton',

    composable: true,

    async run(fs: Store, pathProvider: PathProvider, paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
      const paramVals = await promptParamValues(templateParams, pathProvider, paramProvider);
      modulesEnabled = await promptModulesEnabled(modules, paramProvider);

      for (const m of modules) {
        if (modulesEnabled[m.name]) {
          applyModule(m, modulesEnabled, paramVals, scaffoldDir, fs, pathProvider);
        }
      }

      if (moduleStatusCache) {
        modules.forEach(m => {
          setModuleValue(m, modulesEnabled[m.name], fs, pathProvider, moduleStatusCache);
        });
      }

      return fs;
    },

    exposes: modules.map((m) => `modules.${m.name}`),

    getExposed(_pathProvider: PathProvider, _paramProvider: ParamProvider): Record<string, unknown> {
      return renameKeys(modulesEnabled, k => `modules.${k}`);
    },
  };
}
