import { create, Store } from 'mem-fs';
import { IO } from 'boilersmith/io';
import { Paths } from '../paths';
import { DefaultProviders, Step } from '../step-manager';
import { renameKeys } from '../utils/rename-keys';
import { applyModule, currModulesEnabled, Module, ModuleStatusCache } from './module';
import { currParamValues, TemplateParam } from './template-param';
import { ExcludeScaffoldingFunc } from './scaffolder';
import { condFormat } from 'boilersmith/utils/cond-format';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'node:fs';

export function auditStepFactory<MN extends string, Providers extends DefaultProviders>(
  dry: boolean,
  scaffoldDir: string,
  modules: Module<MN>[],
  templateParams: TemplateParam[],
  excludeScaffoldingFunc?: ExcludeScaffoldingFunc,
  moduleStatusCache?: ModuleStatusCache<MN>,
): Step<Providers> {
  let modulesEnabled: Record<string, boolean>;

  return {
    type: 'Audit for outdated infrastructure files or config.',

    composable: true,

    async run<Providers>(_fs: Store, paths: Paths, io: IO, _providers: Providers): Promise<Store> {
      const paramVals = await currParamValues(templateParams, _fs, paths, io);
      modulesEnabled = await currModulesEnabled(modules, _fs, paths, moduleStatusCache);

      const actionableModules = modules.filter(
        m => m.updatable && modulesEnabled[m.name] && (!m.togglable || !m.dependsOn.some(dep => !modulesEnabled[dep])),
      );

      io.info(
        condFormat(
          io.supportsAnsiColor,
          m => chalk.yellow(chalk.bold(chalk.underline(m))),
          `Auditing infrastructure for ${actionableModules.length} enabled modules:`,
        ),
        true,
      );
      for (const m of modules) {
        if (actionableModules.includes(m)) {
          io.info(
            condFormat(io.supportsAnsiColor, m => chalk.dim(chalk.green(m)), `✓ ${m.name}: ${m.shortDescription}`),
            true,
          );
        } else if (m.updatable) {
          io.info(
            condFormat(io.supportsAnsiColor, m => chalk.dim(chalk.red(m)), `𐄂 ${m.name}: ${m.shortDescription} (disabled)`),
            true,
          );
        }
      }

      for (const m of actionableModules) {
        const fs = dry ? create() : _fs;
        const excludeScaffolding = excludeScaffoldingFunc ? excludeScaffoldingFunc(fs, paths) : [];
        applyModule(m, modulesEnabled, paramVals, scaffoldDir, fs, paths, excludeScaffolding, true);
        if (dry) {
          const filesWithChanges = fs.all()
            .filter(f => f.state && f.state !== 'deleted')
            .filter(f => !existsSync(f.path) || readFileSync(f.path, 'utf8').toString() !== f.contents?.toString());

          io.error(`Module ${m.name} has ${filesWithChanges.length} changed files: ${filesWithChanges.map(f => f.path.replace(paths.package() + '/', '')).join(', ')}`, false);
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
