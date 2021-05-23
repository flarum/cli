import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { pick } from '@zodash/pick';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { PhpProvider } from '../../provider/php-provider';
import { extensionMetadata } from '../../utils/extension-metadata';
import { Step } from '../step-manager';

export abstract class BaseInfraStep implements Step {
  abstract type: string;

  composable = true;

  /**
   * A list of file paths to replace from the boilerplate
   */
  protected abstract filesToReplace: string[];

  /**
   * A map of names of JSON files to keys which should be deep-merged from the boilerplate.
   */
  protected abstract jsonToAugment: Record<string, string[]>;

  async run(fs: Store, pathProvider: PathProvider, _paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
    const fsEditor = create(fs);

    this.filesToReplace.forEach(filePath => {
      fsEditor.copy(pathProvider.boilerplate(`skeleton/extension/${filePath}`), pathProvider.ext(filePath));
    });

    const fakeInitData = extensionMetadata(fsEditor.readJSON(pathProvider.ext('composer.json')));

    Object.keys(this.jsonToAugment).forEach(jsonPath => {
      const boilerplatePath = pathProvider.boilerplate('skeleton/extension', jsonPath);
      const boilerplateTmpPath = pathProvider.boilerplate('skeleton/extension', jsonPath);
      // We copy it to resolve template tags.
      fsEditor.copyTpl(boilerplatePath, boilerplateTmpPath, fakeInitData);
      const boilerplateComposerJson: any = fsEditor.readJSON(boilerplateTmpPath);
      fsEditor.delete(boilerplateTmpPath);

      const fieldsToAugment = this.jsonToAugment[jsonPath];
      const relevant = pick(boilerplateComposerJson, fieldsToAugment);

      fsEditor.extendJSON(pathProvider.ext(jsonPath), relevant);
    });

    return fs;
  }

  exposes = [];

  getExposed(_pathProvider: PathProvider, _paramProvider: ParamProvider): Record<string, unknown> {
    return {};
  }
}
