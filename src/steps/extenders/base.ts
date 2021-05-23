import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { PromptObject } from 'prompts';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { ExtenderDef, PhpProvider } from '../../provider/php-provider';
import { Step } from '../step-manager';
import { cloneAndFill } from '../../utils/clone-and-fill';

interface UserProvidedParam extends Omit<PromptObject, 'type'> {
  type: string;
}

export interface ExtenderGenerationSchema {
  extenderDef: ExtenderDef;

  params: UserProvidedParam[];
}

export abstract class BaseExtenderStep implements Step {
  abstract type: string;

  protected abstract schema: ExtenderGenerationSchema;

  composable = true;

  exposes = [];

  getExposed() {
    return {};
  }

  protected params!: Record<string, unknown>;

  async run(fs: Store, pathProvider: PathProvider, paramProvider: ParamProvider, phpProvider: PhpProvider): Promise<Store> {
    const fsEditor = create(fs);

    this.params = await this.compileParams(paramProvider);

    const filledExtenderDef = cloneAndFill<ExtenderDef>(this.schema.extenderDef, this.params as Record<string, string>);

    const currExtendPhp = fsEditor.read(pathProvider.ext('extend.php'));
    const newExtendPhp = phpProvider.withExtender(currExtendPhp, filledExtenderDef);

    fsEditor.write(pathProvider.ext('extend.php'), newExtendPhp);

    return fs;
  }

  protected async compileParams(paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const params: Record<string, string> = {};

    const paramDefs = this.schema.params;
    for (let i = 0; i < paramDefs.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      params[paramDefs[i].name as string] = await paramProvider.get(paramDefs[i] as PromptObject);
    }

    return params;
  }
}
