import pick from 'pick-deep';
import { Store } from 'mem-fs';
import { create, Editor } from 'mem-fs-editor';
import { ParamDef, IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { Step } from 'boilersmith/step-manager';
import { ComposerJsonSchema, ExtensionMetadata, extensionMetadata } from '../../utils/extension-metadata';
import { cloneAndFill } from '../../utils/clone-and-fill';
import { FlarumProviders } from '../../providers';

interface UserProvidedParam extends Omit<ParamDef, 'type'> {
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

export abstract class BaseStubStep implements Step<FlarumProviders> {
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

  async run(fs: Store, paths: Paths, io: IO, providers: FlarumProviders): Promise<Store> {
    const fsEditor = create(fs);

    this.params = await this.compileParams(fsEditor, paths, io);

    const newFileName = await this.getFileName(fs, paths, io);
    const newFilePath = paths.package(this.schema.root || this.defaultRoot, this.subdir, newFileName);
    const stub = cloneAndFill(this.schema.sourceFile, this.params as Record<string, string>);

    return fs;
  }

  getExposed(_paths: Paths, _paramProvider: IO): Record<string, unknown> {
    return pick(this.params, this.exposes) as BaseStubStep['params'];
  }

  protected async precompileParams(composerJsonContents: ExtensionMetadata, _fsEditor: Editor, _paths: Paths, _paramProvider: IO): Promise<Record<string, unknown>> {
    const params: Record<string, string> = {
      extensionId: composerJsonContents.extensionId,
    };

    return params;
  }

  protected async compileParams(fsEditor: Editor, paths: Paths, io: IO): Promise<Record<string, unknown>> {
    const composerJsonContents = this.composerJsonContents(fsEditor, paths);
    const params: Record<string, unknown> = await this.precompileParams(composerJsonContents, fsEditor, paths, io);

    const paramDefs = this.schema.params.filter(param =>
      !this.implicitParams.includes(param.name as string) && !Object.keys(params).includes(param.name as string));

    for (const paramDef of paramDefs) {
      // eslint-disable-next-line no-await-in-loop
      params[paramDef.name as string] = await io.getParam(paramDef as ParamDef);
    }

    for (const implicitParam of this.implicitParams) {
      if (!params[implicitParam] && io.hasCached(implicitParam)) {
        params[implicitParam] = io.cached()[implicitParam] as string;
      }
    }

    return params;
  }

  protected abstract getFileName(_fs: Store, _paths: Paths, io: IO): Promise<string>;

  protected composerJsonContents(fsEditor: Editor, paths: Paths): ExtensionMetadata {
    return extensionMetadata(fsEditor.readJSON(paths.package('composer.json')) as ComposerJsonSchema);
  }
}
