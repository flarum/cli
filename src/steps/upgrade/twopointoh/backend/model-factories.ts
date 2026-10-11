import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { BaseUpgradeStep, GitCommit, Replacement } from '../base';
import { Column, ExtensionModel, extensionModels, migrationTables } from './extension-models';

/**
 * Give each of the extension's models a factory, written from what its
 * migrations say about the model's table, so that tests naming the model in
 * prepareDatabase() need only give the columns they care about.
 */
export default class ModelFactories extends BaseUpgradeStep {
  type = 'Model factories for tests';

  /** The factories this step wrote. */
  protected written: string[] = [];

  private extension: { models: ExtensionModel[]; byTable: Record<string, string>; tables: Record<string, Column[]> } | null = null;

  replacements(file: string): Replacement[] {
    return file.endsWith('.php') ? [this.addFactory()] : [];
  }

  targets(): string[] {
    return ['src/**/*.php'];
  }

  gitCommit(): GitCommit {
    return {
      message: 'chore(2.0): model factories for tests',
      description: "Flarum 2.0 tests take the columns they leave out from the model's factory.",
    };
  }

  pauseMessage(): string {
    const link = 'https://docs.flarum.org/2.x/extend/testing#model-factories';

    return [
      `Each model has a factory now. Written by this step: ${this.written.join(', ') || 'none'}.`,
      'Tests that give prepareDatabase() a model class, rather than its table, take the columns they leave out from it.',
      'Look for the @TODO comments on columns the migrations gave no default.',
      chalk.underline(link),
    ].join('\n                     ');
  }

  addFactory(): Replacement {
    return (file, code) => {
      const { models, byTable, tables } = this.found();
      const model = models.find((candidate) => candidate.file === file);

      if (!model) return null;

      const factory = path.posix.join(path.posix.dirname(file), `${model.class.split('\\').pop()}Factory.php`);
      const hasFactoryClass = fs.existsSync(path.join(this.root, factory));

      if (model.hasFactory && hasFactoryClass) return null;

      const result = this.php!.run('upgrade.2-0.model-factory', {
        file,
        code,
        data: { columns: tables[model.table] ?? null, models: byTable },
      });

      // A factory the extension already has is its own.
      if (hasFactoryClass) {
        return { updated: result.code };
      }

      this.written.push(factory);

      return { updated: result.code, newFiles: [{ path: factory, code: result.factory }] };
    };
  }

  private found() {
    this.extension ??= {
      ...extensionModels(this.root, this.php!),
      tables: migrationTables(this.root, this.php!),
    };

    return this.extension;
  }
}
