export function extensionId(packageName: string): string {
  return packageName.replace(/(flarum-ext-)|(flarum-)/, '').replace('/', '-');
}

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
  "require-dev"?: Record<string, string>;
  conflict?: Record<string, string>;
  replace?: Record<string, string>;
  provide?: Record<string, string>;
  suggest?: Record<string, string>;
  autoload?: {
    "psr-4"?: Record<string, string>;
    classmap?: Record<string, string[]>;
    files?: Record<string, string[]>;
    "exclude-from-classmap"?: string[];
  };
  "minimum-stability"?: 'dev' | 'alpha' | 'beta' | 'RC' | 'stable';
  "prefer-stable"?: boolean;
  // Some others we definitely don't use
  extra?: {
    "flarum-cli"?: {
      mainGitBranch?: string;
      modules?: Partial<ExtensionModules>
    };
    "flarum-extension"?: {
      title?: string;
      category?: string;
      icon?: {
        name: string;
        backgroundColor: string;
        color: string;
      };
    }
  }
  // Some others we definitely don't use
}

export type ExtensionModules = {
  js: boolean;
  css: boolean;
  locale: boolean;

  admin: boolean;
  forum: boolean;

  gitConf: boolean;
  githubActions: boolean;

  prettier: boolean;
  typescript: boolean;
  bundlewatch: boolean;
  
  backendTesting: boolean;

  editorConfig: boolean;
  styleCi: boolean;
}

export type ExtensionMetadata = {
  packageName: string;
  packageDescription: string;
  licenseType: string;
  authorName: string;
  authorEmail: string;
  packageNamespace: string;
  extensionName: string;
  extensionId: string;

  mainGitBranch: string;
}

export function extensionMetadata(extensionComposerJson: ComposerJsonSchema = {}): ExtensionMetadata {
  const packageName = extensionComposerJson?.name || '';

  const flarumConf = extensionComposerJson?.extra?.['flarum-cli'];
  const modules = flarumConf?.modules;

  return {
    packageName: packageName,
    packageDescription: extensionComposerJson?.description || '',
    licenseType: extensionComposerJson?.license || '',
    authorName: '',
    authorEmail: '',
    packageNamespace: (Object.keys(extensionComposerJson?.autoload?.['psr-4'] ?? {})[0] || '').slice(0, -1),
    extensionName: extensionComposerJson?.extra?.['flarum-extension']?.title || '',
    extensionId: extensionId(packageName),
    mainGitBranch: flarumConf?.mainGitBranch ?? 'main',
  };
}
