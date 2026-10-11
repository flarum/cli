import fs from 'fs';
import path from 'path';
import globby from 'globby';
import { PhpProvider } from '../../../../providers/php-provider';
import { pluralSnakeCaseModel } from '../../../../utils/model-name';

export type ExtensionModel = {
  file: string;
  class: string;
  table: string;
  hasFactory: boolean;
};

export type Column = {
  name: string;
  type: string;
  nullable: boolean;
  autoIncrement: boolean;
  references: string | null;
  default?: { value: unknown };
  values?: string[];
};

const read = (root: string, pattern: string): Record<string, string> =>
  Object.fromEntries(globby.sync(pattern, { cwd: root }).map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]));

/**
 * The extension's models, each with its table, and the models that have, or
 * are given, a factory, by table: core's and the extension's.
 */
export function extensionModels(root: string, php: PhpProvider): { models: ExtensionModel[]; byTable: Record<string, string> } {
  const result = php.run('upgrade.2-0.models', { data: { files: read(root, 'src/**/*.php') } });

  // A model without $table has the one Eloquent names after its class.
  const models: ExtensionModel[] = result.models.map((model: Omit<ExtensionModel, 'table'> & { table: string | null }) => ({
    ...model,
    table: model.table ?? pluralSnakeCaseModel(model.class.split('\\').pop() as string),
  }));

  return {
    models,
    byTable: { ...result.core, ...Object.fromEntries(models.map((model) => [model.table, model.class])) },
  };
}

/**
 * The tables the extension's migrations leave, by name.
 */
export function migrationTables(root: string, php: PhpProvider): Record<string, Column[]> {
  const migrations = Object.fromEntries(Object.entries(read(root, 'migrations/*.php')).map(([file, code]) => [path.basename(file), code]));

  return php.run('upgrade.2-0.migrations-schema', { data: { migrations } }).tables;
}
