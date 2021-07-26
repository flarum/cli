import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { BaseJsStep } from './base';

export class GenerateModelDefinition extends BaseJsStep {
  type = 'Generate JS Model Definition';

  protected async getDefinition(paramProvider: ParamProvider): Promise<string> {
    const className: string = await paramProvider.get({ name: 'className', type: 'text' });
    let modelName: string = await paramProvider.get({ name: 'modelName', type: 'text' });

    if (modelName.includes('-')) {
      modelName = `['${modelName}']`;
    } else {
      modelName = `.${modelName}`;
    }

    return `app.store.models${modelName} = ${className};`;
  }

  protected async getImports(frontend: string, pathProvider: PathProvider, paramProvider: ParamProvider): Promise<string> {
    const className: string = await paramProvider.get({ name: 'className', type: 'text' });
    const classNamespace: string = await paramProvider.get({ name: 'classNamespace', type: 'text' });

    const importPath = this.importPath(frontend, classNamespace);

    return `import ${className} from '${importPath}';`;
  }

  exposes = [];

  getExposed(_pathProvider: PathProvider, _paramProvider: ParamProvider): Record<string, unknown> {
    return {};
  }
}
