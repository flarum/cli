import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { BaseJsStep } from './base';

export class GenerateModelDefinition extends BaseJsStep {
  type = 'Generate JS Model Definition';

  protected async getDefinition(io: IO): Promise<string> {
    const className: string = await io.getParam({ name: 'className', message: 'Class name', type: 'text' });
    let modelType: string = await io.getParam({ name: 'modelType', message: 'Model type', type: 'text' });

    modelType = modelType.includes('-') ? `['${modelType}']` : `.${modelType}`;

    return `app.store.models${modelType} = ${className};`;
  }

  protected async getImports(frontend: string, paths: Paths, io: IO): Promise<string> {
    const className: string = await io.getParam({ name: 'className', message: 'Class name', type: 'text' });
    const classNamespace: string = await io.getParam({ name: 'classNamespace', message: 'Class namespace', type: 'text' });

    const importPath = this.importPath(frontend, classNamespace);

    return `import ${className} from '${importPath}';`;
  }

  exposes = [];

  getExposed(_paths: Paths, _paramProvider: IO): Record<string, unknown> {
    return {};
  }
}
