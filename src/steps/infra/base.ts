import pick from 'pick-deep';
import { Store } from 'mem-fs';
import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { PhpProvider } from '../../providers/php-provider';
import { Step } from 'boilersmith/step-manager';

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

  async run(fs: Store, paths: Paths, _paramProvider: IO, providers: {}): Promise<Store> {
    return fs;
  }

  exposes = [];

  getExposed(_paths: Paths, _paramProvider: IO): Record<string, unknown> {
    return {};
  }
}
