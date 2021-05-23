import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { pick } from '@zodash/pick';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { PhpProvider } from '../../provider/php-provider';
import { extensionMetadata } from '../../utils/extension-metadata';
import { Step } from '../step-manager';

export class BackendTestingInfra implements Step {
  type = 'Add/update backend testing infrastructure';

  composable = true;

  async run(fs: Store, pathProvider: PathProvider, _paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
    const fsEditor = create(fs);

    const infraFiles = [
      'tests/phpunit.integration.xml',
      'tests/phpunit.unit.xml',
      'tests/fixtures/.gitkeep',
      'tests/integration/setup.php',
      'tests/unit/.gitkeep',
      '.github/workflows/test.yml',
    ];

    infraFiles.forEach(filePath => {
      fsEditor.copy(pathProvider.boilerplate(`skeleton/extension/${filePath}`), pathProvider.ext(filePath));
    });

    const fakeInitData = extensionMetadata(fsEditor.readJSON(pathProvider.ext('composer.json')));

    const boilerplateComposerPath = pathProvider.boilerplate('skeleton/extension/composer.json');
    const boilerplateComposerTmpPath = pathProvider.boilerplate('skeleton/extension/composer.json.tmp');
    // We copy it to resolve template tags.
    fsEditor.copyTpl(boilerplateComposerPath, boilerplateComposerTmpPath, fakeInitData);
    const boilerplateComposerJson: any = fsEditor.readJSON(boilerplateComposerTmpPath);
    fsEditor.delete(boilerplateComposerTmpPath);

    const relevant = pick(boilerplateComposerJson, ['scripts', 'scripts-description', 'require-dev']);

    fsEditor.extendJSON(pathProvider.ext('composer.json'), relevant);

    return fs;
  }

  exposes = [];

  getExposed(_pathProvider: PathProvider, _paramProvider: ParamProvider): Record<string, unknown> {
    return {};
  }
}
