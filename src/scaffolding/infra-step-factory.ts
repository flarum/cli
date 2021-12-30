import { Store } from 'mem-fs';
import { ParamProvider } from '../../src/provider/param-provider';
import { PathProvider } from '../../src/provider/path-provider';
import { PhpProvider } from '../../src/provider/php-provider';
import { Step } from '../../src/steps/step-manager';
import { applyModule, Module, ModuleStatusCache, promptModulesEnabled, setModuleValue } from './module';
import { promptParamValues, TemplateParam } from './template-param';

export function infraStepFactory(
  scaffoldDir: string,
  moduleName: string,
  modules: Module[],
  templateParams: TemplateParam<unknown>[],
  moduleStatusCache?: ModuleStatusCache
): Step {
  const module = modules.find(m => m.name === moduleName);
  if (!module) {
    throw new Error(`Module ${moduleName} not found`);
  }

  return {
    type: module.shortDescription,

    composable: true,

    async run(fs: Store, pathProvider: PathProvider, paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
      const paramVals = await promptParamValues(templateParams, pathProvider, paramProvider);
      const modulesEnabled = await promptModulesEnabled(modules, paramProvider);

      applyModule(module, modulesEnabled, paramVals, scaffoldDir, fs, pathProvider, false);

      if (moduleStatusCache) {
        setModuleValue(module, true, fs, pathProvider, moduleStatusCache);
      }

      return fs;
    },

    exposes: [],

    getExposed(_pathProvider: PathProvider, _paramProvider: ParamProvider): Record<string, unknown> {
      return {};
    },
  };
}
