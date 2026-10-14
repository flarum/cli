import chalk from 'chalk';
import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { Validator } from '../../../utils/validation';
import { pluralKebabCaseModel } from '../../../utils/model-name';
import { BasePhpStubStep } from '../php-base';
import { Store } from 'mem-fs';
import { StubGenerationSchema } from 'boilersmith/steps/stub-base';

export class GenerateAdvancedApiResourceStub extends BasePhpStubStep {
  type = 'Generate Api Resource Class';

  protected additionalExposes = ['className', 'modelClass', 'modelClassName', 'modelType'];

  protected additionalImplicitParams = ['modelType'];

  protected phpClassParams = ['modelClass'];

  protected schema: StubGenerationSchema = {
    recommendedSubdir: 'Api/Resource',
    sourceFile: 'backend/advanced-api-resource.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: 'Resource class name',
        validate: Validator.className,
      },
      {
        name: 'classNamespace',
        type: 'text',
        message: 'Class Namespace',
      },
      {
        name: 'modelClass',
        type: 'text',
        message: `Model Class (${chalk.dim('Vendor\\Path\\Model')})`,
        validate: Validator.class,
      },
      {
        name: 'modelClassName',
        type: 'text',
        message: 'Model class name',
      },
      {
        name: 'modelType',
        type: 'text',
        message: 'Model type',
      },
      {
        name: 'endpoints',
        type: 'multiselect',
        message: 'Endpoints',
        choices: [
          { title: 'index', value: 'list', selected: true },
          { title: 'show', value: 'show', selected: true },
          { title: 'create', value: 'create', selected: true },
          { title: 'update', value: 'update', selected: true },
          { title: 'delete', value: 'delete', selected: true },
        ],
      },
      {
        name: 'relations',
        type: 'multiselect',
        message: 'Relations',
      },
    ],
  };

  protected async compileParams(fs: Store, paths: Paths, io: IO): Promise<Record<string, unknown>> {
    const params = await super.compileParams(fs, paths, io);

    const interfaceMap: Record<string, string> = {
      list: 'Resource\\Contracts\\Listable',
      show: 'Resource\\Contracts\\Findable',
      create: 'Resource\\Contracts\\Creatable',
      update: 'Resource\\Contracts\\Updatable',
      delete: 'Resource\\Contracts\\Deletable',
    };

    params.modelType ||= pluralKebabCaseModel(params.modelClassName as string);
    params.interfaces = (params.endpoints as string[]).map((endpoint) => interfaceMap[endpoint]);

    return params;
  }
}
