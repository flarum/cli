import { BaseStubStep } from './base';
import { Editor } from 'mem-fs-editor';
import { PromptObject } from 'prompts';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';

export abstract class BasePhpStubStep extends BaseStubStep {
  protected defaultRoot = './src';

  get exposes(): string[] {
    return [...super.exposes, 'class'];
  }

  get implicitParams(): string[] {
    return [...super.implicitParams, 'classNamespace'];
  }

  protected phpClassParams: string[] = [];

  protected async precompileParams(composerJsonContents: any, fsEditor: Editor, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {
      ...await super.precompileParams(composerJsonContents, fsEditor, pathProvider, paramProvider),
      classNamespace: this.stubNamespace(composerJsonContents, pathProvider),
    };

    let paramDefs = this.schema.params.filter(param => !this.implicitParams.includes(param.name as string));

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
      params[`${classParam}Name`] = (params[classParam] as string).split('\\').pop();
      paramDefs = paramDefs.filter(param => param.name !== classParam && param.name !== `${classParam}Name`);
    }

    return params;
  }

  protected async getFileName(_fs: Store, _pathProvider: PathProvider, paramProvider: ParamProvider): Promise<string> {
    return await paramProvider.get<string>({ name: 'className', type: 'text' }) + '.php';
  }

  protected stubNamespace(composerJsonContents: any, pathProvider: PathProvider): string {
    const packageNamespace = composerJsonContents.packageNamespace;

    let subdir: string;
    if (this.schema.forceRecommendedSubdir || pathProvider.requestedDir() === null) {
      subdir = this.schema.recommendedSubdir.replace('\\', '.').replace('/', '.');
    } else {
      subdir = pathProvider.requestedDir()!.slice(`${pathProvider.ext('src')}/`.length);
    }

    this.subdir = subdir.replace('.', '/');

    let namespace = `${packageNamespace}`;

    if (this.schema.root === './tests') {
      namespace += '\\tests';
    }

    if (subdir) {
      namespace += `\\${subdir.replace('.', '\\')}`;
    }

    return namespace;
  }
}
