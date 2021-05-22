export function extensionMetadata(extensionComposerJson: any = {}) {
  const data: any = {};
  data.packageName = extensionComposerJson?.name || '';
  data.packageDescription = extensionComposerJson?.description || '';
  data.licenseType = extensionComposerJson?.license || '';
  data.authorName = '';
  data.authorEmail = '';
  data.packageNamespace = (Object.keys(extensionComposerJson?.autoload?.['psr-4'] ?? {})[0] || '').slice(0, -1).replace('\\', '\\\\');
  data.extensionName = extensionComposerJson?.extra?.['flarum-extension']?.title || '';

  return data;
}
