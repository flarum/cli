import { Paths } from 'boilersmith/paths';
import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { ExtensionModules } from '../steps/gen-ext-scaffolder';

export type ComposerJsonSchema = {
  name?: string;
  description?: string;
  type?: string;
  keywords?: string[];
  homepage?: string;
  readme?: string;
  license?: string;
  authors?: {
    name?: string;
    email?: string;
    homepage?: string;
    role?: string;
  }[];
  support?: {
    email?: string;
    issues?: string;
    forum?: string;
    wiki?: string;
    irc?: string;
    source?: string;
    docs?: string;
    rss?: string;
    chat?: string;
  };
  funding?: {
    type: string;
    url: string;
  }[];
  require?: Record<string, string>;
  'require-dev'?: Record<string, string>;
  conflict?: Record<string, string>;
  replace?: Record<string, string>;
  provide?: Record<string, string>;
  suggest?: Record<string, string>;
  autoload?: {
    'psr-4'?: Record<string, string>;
    classmap?: Record<string, string[]>;
    files?: Record<string, string[]>;
    'exclude-from-classmap'?: string[];
  };
  'minimum-stability'?: 'dev' | 'alpha' | 'beta' | 'RC' | 'stable';
  'prefer-stable'?: boolean;
  // Some others we definitely don't use
  extra?: {
    'flarum-cli'?: {
      excludeScaffolding?: string[];
      mainGitBranch?: string;
      modules?: Record<ExtensionModules, boolean>;
    };
    'flarum-extension'?: {
      title?: string;
      category?: string;
      icon?: {
        name: string;
        backgroundColor: string;
        color: string;
      };
    };
  };
  // Some others we definitely don't use
};

export function getComposerJson(fs: Store, paths: Paths): ComposerJsonSchema {
  return create(fs).readJSON(paths.package('composer.json')) as ComposerJsonSchema;
}
