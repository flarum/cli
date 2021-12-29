import { Store } from 'mem-fs';

interface FileOwnership {
  /**
   * The path to the file
   */
  path: string;

  /**
   * If any of the needed modules aren't enabled, the file won't be updated.
   */
  needsOneOfModules?: string[];
}

interface CommonModule {
  name: string;

  shortDescription: string;

  longDescription?: string;

  /**
   * Whether files belonging to this module should be kept up to date.
   */
  updatable: boolean;

  /**
   * A list of scaffolding files managed by this module.
   */
  filesToReplace: (string | FileOwnership)[];

  /**
   * A map of names of JSON files to keys which should be deep-merged from the scaffolding.
   */
  jsonToAugment: Record<string, string[]>;

  /**
   * An array of names of template params needed by this module.
   */
  needsTemplateParams: string[];
}

interface UntoggleableModule extends CommonModule {
  /**
   * Whether this module can be enabled/disabled.
   */
  togglable: false;
}

interface TogglableModule extends CommonModule {
  /**
   * Whether this module can be enabled/disabled.
   */
  togglable: true;

  /**
   * Whether this module is enabled or disabled by default.
   */
  defaultEnabled: boolean;

  /**
   * Can only be enabled if these other modules are enabled.
   */
  dependsOn: string[];
}

export type Module = UntoggleableModule | TogglableModule;
