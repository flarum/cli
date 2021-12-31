import { Store } from 'mem-fs';
import { Editor } from 'mem-fs-editor';
import { BaseStubStep } from 'boilersmith/steps/base';
import { ParamDef, IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { Scaffolder } from 'boilersmith/scaffolding/scaffolder';
import { FlarumBaseStubStep } from './flarum-base';
import { FlarumProviders } from 'src/providers';
import { genExtScaffolder } from '../gen-ext-scaffolder';

export abstract class BasePhpStubStep extends FlarumBaseStubStep {
  protected defaultRoot = './src';

  get exposes(): string[] {
    return [...super.exposes, 'class'];
  }

  get implicitParams(): string[] {
    return [...super.implicitParams, 'classNamespace'];
  }

  protected phpClassParams: string[] = [];

  protected async precompileParams(fs: Store, paths: Paths, io: IO): Promise<Record<string, unknown>> {  
    const params: Record<string, unknown> = {
      ...await super.precompileParams(fs, paths, io),
      classNamespace: this.stubNamespace(await this.scaffolder.templateParamVal('packageNamespace', fs, paths), paths),
    };

    let paramDefs = this.schema.params.filter(param => !this.implicitParams.includes(param.name as string));

    const classParams = [...this.phpClassParams];
    const classNameParam = paramDefs.find(param => param.name === 'className');

    if (classNameParam) {
      params.className = await io.getParam(classNameParam as ParamDef);
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
      params[classParam] = await io.getParam(paramDef as ParamDef);
      params[`${classParam}Name`] = (params[classParam] as string).split('\\').pop();
      paramDefs = paramDefs.filter(param => param.name !== classParam && param.name !== `${classParam}Name`);
    }

    return params;
  }

  protected async getFileName(_fs: Store, _paths: Paths, io: IO): Promise<string> {
    return await io.getParam<string>({ name: 'className', type: 'text' }) + '.php';
  }

  protected stubNamespace(packageNamespace: string, paths: Paths): string {
    const subdir = this.schema.forceRecommendedSubdir || paths.requestedDir() === null ? this.schema.recommendedSubdir.replace('\\', '.').replace('/', '.') : paths.requestedDir()!.slice(`${paths.package((this.schema.root || this.defaultRoot).replace('./', ''))}/`.length);

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
