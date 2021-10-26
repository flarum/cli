import pick from 'pick-deep';
import { Store } from 'mem-fs';
import { create, Editor } from 'mem-fs-editor';
import { PromptObject } from 'prompts';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { PhpProvider } from '../../provider/php-provider';
import { Step } from '../step-manager';
import { extensionMetadata } from '../../utils/extension-metadata';
import { cloneAndFill } from '../../utils/clone-and-fill';

interface UserProvidedParam extends Omit<PromptObject, 'type'> {
  type: string;
}

export interface StubGenerationSchema {
  /**
   * A period-delimited subdirectory for where the stub should be
   * located relative to the extension PHP src.
   */
  recommendedSubdir: string;

  forceRecommendedSubdir?: boolean;

  /**
   * Where should the file be created in relation to the extension root?
   *
   * Defaults to `./src`.
   */
  root?: string;

  /**
   * The relative path to the stub's source file relative to the
   * `stubs` directory.
   */
  sourceFile: string;

  params: UserProvidedParam[];
}

export abstract class BaseStubStep implements Step {
  abstract type: string;

  protected abstract defaultRoot: string;

  protected abstract schema: StubGenerationSchema;

  composable = true;

  get exposes(): string[] {
    return this.additionalExposes;
  }

  protected additionalExposes: string[] = [];

  get implicitParams(): string[] {
    return [...this.additionalImplicitParams, 'extensionId'];
  }

  protected additionalImplicitParams: string[] = [];

  protected params: Record<string, unknown> = {};

  protected subdir !: string;

  async run(fs: Store, pathProvider: PathProvider, paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
    const fsEditor = create(fs);

    this.params = await this.compileParams(fsEditor, pathProvider, paramProvider);

    const newFileName = await this.getFileName(fs, pathProvider, paramProvider);
    const newFilePath = pathProvider.ext(this.schema.root || this.defaultRoot, this.subdir, newFileName);
    const stub = cloneAndFill(this.schema.sourceFile, this.params as Record<string, string>);

    fsEditor.copyTpl(pathProvider.boilerplate('stubs', stub), newFilePath, this.params);

    return fs;
  }

  getExposed(_pathProvider: PathProvider, _paramProvider: ParamProvider): Record<string, unknown> {
    return pick(this.params, this.exposes) as BaseStubStep['params'];
  }

  protected async precompileParams(composerJsonContents: any, _fsEditor: Editor, _pathProvider: PathProvider, _paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const params: Record<string, string> = {
      extensionId: composerJsonContents.extensionId,
    };

    return params;
  }

  protected async compileParams(fsEditor: Editor, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const composerJsonContents = this.composerJsonContents(fsEditor, pathProvider);
    const params: Record<string, unknown> = await this.precompileParams(composerJsonContents, fsEditor, pathProvider, paramProvider);

    const paramDefs = this.schema.params.filter(param =>
      !this.implicitParams.includes(param.name as string) && !Object.keys(params).includes(param.name as string));

    for (let i = 0; i < paramDefs.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      params[paramDefs[i].name as string] = await paramProvider.get(paramDefs[i] as PromptObject);
    }

    this.implicitParams.forEach(implicitParam => {
      if (!params[implicitParam] && paramProvider.has(implicitParam)) {
        params[implicitParam] = paramProvider.cached()[implicitParam] as string;
      }
    });

    return params;
  }

  protected abstract getFileName(_fs: Store, _pathProvider: PathProvider, paramProvider: ParamProvider): Promise<string>;

  protected composerJsonContents(fsEditor: Editor, pathProvider: PathProvider): any {
    return extensionMetadata(fsEditor.readJSON(pathProvider.ext('composer.json')));
  }
}
