import { Store } from 'mem-fs';
import { Editor } from 'mem-fs-editor';
import { BaseStubStep } from './base';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';

export abstract class BaseJsStubStep extends BaseStubStep {
  protected defaultRoot = './js/src';

  get exposes(): string[] {
    return [...super.exposes, 'className'];
  }

  get implicitParams(): string[] {
    return [...super.implicitParams];
  }

  protected async precompileParams(composerJsonContents: any, fsEditor: Editor, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const params = await super.precompileParams(composerJsonContents, fsEditor, pathProvider, paramProvider);

    if (this.schema.forceRecommendedSubdir || pathProvider.requestedDir() === null) {
      this.subdir = this.schema.recommendedSubdir;
    } else {
      this.subdir = pathProvider.requestedDir()!.slice(`${pathProvider.ext('js/src')}/`.length);
    }

    return params;
  }

  protected async getFileName(_fs: Store, _pathProvider: PathProvider, paramProvider: ParamProvider): Promise<string> {
    return await paramProvider.get<string>({ name: 'className', type: 'text' }) + '.js';
  }
}