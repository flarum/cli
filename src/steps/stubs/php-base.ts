import { pick } from '@zodash/pick';
import { Store } from 'mem-fs';
import { create, Editor } from 'mem-fs-editor';
import { PromptObject } from 'prompts';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { PhpProvider } from '../../provider/php-provider';
import { Step } from '../step-manager';
import { extensionMetadata } from '../../utils/extension-metadata';

interface UserProvidedParam extends Omit<PromptObject, 'type'> {
  type: string;
}

export interface StubGenerationSchema {
  /**
   * A period-delimited subdirectory for where the stub should be
   * located relative to the extension PHP src.
   */
  recommendedSubdir: string;

  /**
   * The relative path to the stub's source file relative to the
   * `stubs` directory.
   */
  sourceFile: string;

  params: UserProvidedParam[];
}

export abstract class BasePhpStubStep implements Step {
  abstract type: string;

  protected abstract schema: StubGenerationSchema;

  composable = true;

  get exposes(): string[] {
    return [...this.additionalExposes, 'class'];
  }

  protected additionalExposes: string[] = []

  protected params: Record<string, unknown> = {};

  async run(fs: Store, pathProvider: PathProvider, paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
    const fsEditor = create(fs);

    this.params = await this.compileParams(fsEditor, pathProvider, paramProvider);

    const newFilePath = pathProvider.ext('src', this.subdir, `${this.params.className}.php`);

    fsEditor.copyTpl(pathProvider.boilerplate('stubs', this.schema.sourceFile), newFilePath, this.params);

    return fs;
  }

  getExposed(_pathProvider: PathProvider, _paramProvider: ParamProvider): Record<string, unknown> {
    return pick(this.params, this.exposes);
  }

  protected phpClassParams: string[] = [];

  protected async compileParams(fsEditor: Editor, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const params: Record<string, string> = {
      classNamespace: this.stubNamespace(fsEditor, pathProvider),
    };

    let paramDefs = this.schema.params.filter(param => param.name !== 'classNamespace');

    const classParams = [...this.phpClassParams];
    const classNameParam = paramDefs.find(param => param.name === 'className');

    if (classNameParam) {
      params.className = await paramProvider.get(classNameParam as PromptObject);
      params.class = `${params.classNamespace}\\${params.className}`;
      paramDefs = paramDefs.filter(param => param.name !== 'class' && param.name !== 'className');
    } else {
      classParams.push('class');
    }

    for (let i = 0; i < classParams.length; i++) {
      const classParam = classParams[i];

      const paramDef = this.schema.params.find(param => param.name === classParam);

      if (!paramDef) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      params[classParam] = await paramProvider.get(paramDef as PromptObject);
      params[`${classParam}Name`] = params[classParam].split('\\')[-1];
      paramDefs = paramDefs.filter(param => param.name !== classParam && param.name !== `${classParam}Name`);
    }

    for (let i = 0; i < paramDefs.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      params[paramDefs[i].name as string] = await paramProvider.get(paramDefs[i] as PromptObject);
    }

    return params;
  }

  protected async getFileName(paramProvider: ParamProvider): Promise<string> {
    return paramProvider.get<string>({ name: 'className', type: 'text' });
  }

  protected subdir !: string;

  protected stubNamespace(fsEditor: Editor, pathProvider: PathProvider): string {
    const composerJsonContents = fsEditor.readJSON(pathProvider.ext('composer.json'));
    const packageNamespace = extensionMetadata(composerJsonContents).packageNamespace;

    let subdir: string;
    if (pathProvider.requestedDir() === null) {
      subdir = this.schema.recommendedSubdir.replace('\\', '.').replace('/', '.');
    } else {
      subdir = pathProvider.requestedDir()!.slice(`${pathProvider.ext('src')}/`.length);
    }

    this.subdir = subdir;

    return `${packageNamespace}\\${subdir.replace('.', '\\')}`;
  }
}
