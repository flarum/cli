import { Store } from 'mem-fs';
import { ParamDef, IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { cloneAndFill } from '../../boilersmith/utils/clone-and-fill';
import { FlarumBaseStubStep } from './flarum-base';

export abstract class BaseJsStubStep extends FlarumBaseStubStep {
  protected defaultRoot = './js/src';

  get exposes(): string[] {
    return [...super.exposes, 'className'];
  }

  get implicitParams(): string[] {
    return [...super.implicitParams, 'classNamespace'];
  }

  protected async precompileParams(fs: Store, paths: Paths, io: IO): Promise<Record<string, unknown>> {
    const params = await super.precompileParams(fs, paths, io);

    const paramDefs = this.schema.params.filter(param => !this.implicitParams.includes(param.name as string));

    this.subdir = this.schema.forceRecommendedSubdir || paths.requestedDir() === null ? this.schema.recommendedSubdir : paths.requestedDir()!.slice(`${paths.package('js/src')}/`.length);

    params.frontend = await io.getParam(paramDefs.find(param => param.name === 'frontend') as ParamDef);
    params.className = await io.getParam(paramDefs.find(param => param.name === 'className') as ParamDef);

    this.subdir = cloneAndFill(this.subdir, params as Record<string, string>);

    params.classNamespace = `${this.subdir}/${params.className}`;

    return params;
  }

  protected async getFileName(_fs: Store, _paths: Paths, io: IO): Promise<string> {
    return await io.getParam<string>({ name: 'className', type: 'text' }) + '.js';
  }
}
