import { Store } from 'mem-fs';
import { Editor } from 'mem-fs-editor';
import { PromptObject } from 'prompts';
import { BaseStubStep } from './base';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { cloneAndFill } from '../../utils/clone-and-fill';

export abstract class BaseJsStubStep extends BaseStubStep {
  protected defaultRoot = './js/src';

  get exposes(): string[] {
    return [...super.exposes, 'className'];
  }

  get implicitParams(): string[] {
    return [...super.implicitParams, 'classNamespace'];
  }

  protected async precompileParams(composerJsonContents: any, fsEditor: Editor, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const params = await super.precompileParams(composerJsonContents, fsEditor, pathProvider, paramProvider);

    const paramDefs = this.schema.params.filter(param => !this.implicitParams.includes(param.name as string));

    if (this.schema.forceRecommendedSubdir || pathProvider.requestedDir() === null) {
      this.subdir = this.schema.recommendedSubdir;
    } else {
      this.subdir = pathProvider.requestedDir()!.slice(`${pathProvider.ext('js/src')}/`.length);
    }

    params.frontend = await paramProvider.get(paramDefs.find(param => param.name === 'frontend') as PromptObject);
    params.className = await paramProvider.get(paramDefs.find(param => param.name === 'className') as PromptObject);

    this.subdir = cloneAndFill(this.subdir, params as Record<string, string>);

    params.classNamespace = `${this.subdir}/${params.className}`;

    return params;
  }

  protected async getFileName(_fs: Store, _pathProvider: PathProvider, paramProvider: ParamProvider): Promise<string> {
    return await paramProvider.get<string>({ name: 'className', type: 'text' }) + '.js';
  }
}
