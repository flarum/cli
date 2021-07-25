import { BaseStubStep } from './base';
import { Editor } from 'mem-fs-editor';
import { PromptObject } from 'prompts';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';

export abstract class BaseJsStubStep extends BaseStubStep {
  protected defaultRoot = './js/src/${frontend}';

  get exposes(): string[] {
    return [...super.exposes, 'className'];
  }

  get implicitParams(): string[] {
    return [...super.implicitParams];
  }

  protected async precompileParams(composerJsonContents: any, fsEditor: Editor, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const params = await super.precompileParams(composerJsonContents, fsEditor, pathProvider, paramProvider);

    this.subdir = this.schema.recommendedSubdir;

    return params;
  }

  protected async getFileName(_fs: Store, _pathProvider: PathProvider, paramProvider: ParamProvider): Promise<string> {
    return await paramProvider.get<string>({ name: 'className', type: 'text' }) + '.js';
  }
}
