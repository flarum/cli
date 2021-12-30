import { Store } from 'mem-fs';
import { Editor } from 'mem-fs-editor';
import { BaseStubStep } from './base';
import { ParamDef, ParamProvider } from 'boilersmith/param-provider';
import { PathProvider } from 'boilersmith/path-provider';
import { ExtensionMetadata } from '../../utils/extension-metadata';

export abstract class BasePhpStubStep extends BaseStubStep {
  protected defaultRoot = './src';

  get exposes(): string[] {
    return [...super.exposes, 'class'];
  }

  get implicitParams(): string[] {
    return [...super.implicitParams, 'classNamespace'];
  }

  protected phpClassParams: string[] = [];

  protected async precompileParams(composerJsonContents: ExtensionMetadata, fsEditor: Editor, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {
      ...await super.precompileParams(composerJsonContents, fsEditor, pathProvider, paramProvider),
      classNamespace: this.stubNamespace(composerJsonContents, pathProvider),
    };

    let paramDefs = this.schema.params.filter(param => !this.implicitParams.includes(param.name as string));

    const classParams = [...this.phpClassParams];
    const classNameParam = paramDefs.find(param => param.name === 'className');

    if (classNameParam) {
      params.className = await paramProvider.get(classNameParam as ParamDef);
      params.class = `${params.classNamespace}\\${params.className}`;
      paramDefs = paramDefs.filter(param => param.name !== 'class' && param.name !== 'className');
    } else {
      classParams.push('class');
    }

    for (const classParam of classParams) {
      const paramDef = this.schema.params.find(param => param.name === classParam);

      if (!paramDef) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      params[classParam] = await paramProvider.get(paramDef as ParamDef);
      params[`${classParam}Name`] = (params[classParam] as string).split('\\').pop();
      paramDefs = paramDefs.filter(param => param.name !== classParam && param.name !== `${classParam}Name`);
    }

    return params;
  }

  protected async getFileName(_fs: Store, _pathProvider: PathProvider, paramProvider: ParamProvider): Promise<string> {
    return await paramProvider.get<string>({ name: 'className', type: 'text' }) + '.php';
  }

  protected stubNamespace(composerJsonContents: ExtensionMetadata, pathProvider: PathProvider): string {
    const packageNamespace = composerJsonContents.packageNamespace;

    const subdir = this.schema.forceRecommendedSubdir || pathProvider.requestedDir() === null ? this.schema.recommendedSubdir.replace('\\', '.').replace('/', '.') : pathProvider.requestedDir()!.slice(`${pathProvider.ext((this.schema.root || this.defaultRoot).replace('./', ''))}/`.length);

    this.subdir = subdir.replace('.', '/');

    let namespace = packageNamespace;

    if (this.schema.root === './tests') {
      namespace += '\\tests';
    }

    if (subdir) {
      namespace += `\\${subdir.replace('.', '\\')}`;
    }

    return namespace;
  }
}
