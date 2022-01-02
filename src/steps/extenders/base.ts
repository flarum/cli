import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { ParamDef, IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { ExtenderDef } from '../../providers/php-provider';
import { Step } from 'boilersmith/step-manager';
import { cloneAndFill } from 'boilersmith/utils/clone-and-fill';
import { FlarumProviders } from '../../providers';

interface UserProvidedParam extends Omit<ParamDef, 'type'> {
  type: string;
}

export interface ExtenderGenerationSchema {
  extenderDef: ExtenderDef;

  params: UserProvidedParam[];
}

export abstract class BaseExtenderStep implements Step<FlarumProviders> {
  abstract type: string;

  protected abstract schema: ExtenderGenerationSchema;

  composable = true;

  exposes = [];

  getExposed(): Record<string, unknown>  {
    return {};
  }

  protected params!: Record<string, unknown>;

  async run(fs: Store, paths: Paths, io: IO, providers: FlarumProviders): Promise<Store> {
    const fsEditor = create(fs);

    this.params = await this.compileParams(io);

    const filledExtenderDef = cloneAndFill<ExtenderDef>(this.schema.extenderDef, this.params as Record<string, string>);

    const currExtendPhp = fsEditor.read(paths.package('extend.php'));
    const newExtendPhp = providers.php.withExtender(currExtendPhp, filledExtenderDef);

    fsEditor.write(paths.package('extend.php'), newExtendPhp);

    return fs;
  }

  protected async compileParams(io: IO): Promise<Record<string, unknown>> {
    const params: Record<string, string> = {};

    const paramDefs = this.schema.params;
    for (const paramDef of paramDefs) {
      // eslint-disable-next-line no-await-in-loop
      params[paramDef.name as string] = await io.getParam(paramDef as ParamDef);
    }

    return params;
  }
}
