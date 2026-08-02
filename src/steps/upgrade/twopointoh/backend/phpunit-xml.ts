/**
 * Convert a PHPUnit 9-era config to the shape the CLI scaffolds for 2.x
 * extensions: schema resolved from the vendored phpunit, the attributes
 * PHPUnit 10 removed dropped or renamed, coverage's include list moved to
 * <source>, the Mockery listener block removed, and warning details enabled
 * so flarum/testing's query guard is visible in the output.
 */
export function modernizePhpunitXml(file: string, code: string): string {
  // The schema path is relative to the config file's own directory.
  const prefix = '../'.repeat(file.split('/').length - 1);
  let updated = code.replace(/xsi:noNamespaceSchemaLocation="[^"]*"/, `xsi:noNamespaceSchemaLocation="${prefix}vendor/phpunit/phpunit/phpunit.xsd"`);

  // Attributes removed in PHPUnit 10.
  updated = updated.replace(
    /[\t ]*(?:convert(?:Deprecations|Errors|Notices|Warnings)ToExceptions|forceCoversAnnotation|verbose|printerClass)="[^"]*"\r?\n/g,
    ''
  );
  updated = updated.replace(/backupStaticAttributes=/g, 'backupStaticProperties=');

  // New settings, inserted next to their neighbours in the scaffolded order.
  if (!updated.includes('cacheDirectory=')) {
    updated = updated.replace(/(\n([\t ]*)backupGlobals="[^"]*")/, '$1\n$2cacheDirectory=".phpunit.cache"');
  }

  if (!updated.includes('displayDetailsOnTestsThatTriggerWarnings=')) {
    updated = updated.replace(/(\n([\t ]*)colors="[^"]*")/, '$1\n$2displayDetailsOnTestsThatTriggerWarnings="true"');
  }

  // The include list lives in <source> now; coverage configuration as it
  // existed in 9.x is gone.
  updated = updated.replace(/<coverage[^>]*>/, '<source>').replace(/<\/coverage>/, '</source>');

  // Test listeners were removed in PHPUnit 10 (Mockery integration works
  // without one).
  updated = updated.replace(/[\t ]*<listeners>[\S\s]*?<\/listeners>\r?\n?/, '');

  return updated;
}
