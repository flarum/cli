export function extensionId(packageName: string): string {
  return packageName.replace(/(flarum-ext-)|(flarum-)/, '').replace('/', '-');
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
}

export function extensionMetadata(extensionComposerJson: any = {}): ExtensionMetadata {
  const packageName = extensionComposerJson?.name || '';

  return {
    packageName: packageName,
    packageDescription: extensionComposerJson?.description || '',
    licenseType: extensionComposerJson?.license || '',
    authorName: '',
    authorEmail: '',
    packageNamespace: (Object.keys(extensionComposerJson?.autoload?.['psr-4'] ?? {})[0] || '').slice(0, -1),
    extensionName: extensionComposerJson?.extra?.['flarum-extension']?.title || '',
    extensionId: extensionId(packageName),
  };
}
