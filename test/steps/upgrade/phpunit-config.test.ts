import { modernizePhpunitXml } from '../../../src/steps/upgrade/twopointoh/backend/phpunit-xml';

/**
 * Extensions upgraded from 1.x carry PHPUnit 9.3-schema configs: attributes
 * removed in PHPUnit 10+, the <coverage> element, the Mockery listener block.
 * PHPUnit 12 flags a deprecation on every run, warnings hide behind summary
 * counts, and the version-pinned schema URL no longer matches the installed
 * phpunit. These tests pin the conversion to the shape the CLI scaffolds.
 */

const oldIntegration = `<?xml version="1.0" encoding="UTF-8"?>
<phpunit
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="https://schema.phpunit.de/9.3/phpunit.xsd"
    backupGlobals="false"
    backupStaticAttributes="false"
    colors="true"
    convertErrorsToExceptions="true"
    convertNoticesToExceptions="true"
    convertWarningsToExceptions="true"
    processIsolation="true"
    stopOnFailure="false"
>
    <coverage processUncoveredFiles="true">
        <include>
            <directory suffix=".php">../src/</directory>
        </include>
    </coverage>
    <testsuites>
        <testsuite name="Flarum Integration Tests">
            <directory suffix="Test.php">./integration</directory>
             <exclude>./integration/tmp</exclude>
        </testsuite>
    </testsuites>
</phpunit>
`;

const oldUnit = `<?xml version="1.0" encoding="UTF-8"?>
<phpunit
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="https://schema.phpunit.de/9.3/phpunit.xsd"
    backupGlobals="false"
    backupStaticAttributes="false"
    colors="true"
    convertErrorsToExceptions="true"
    convertNoticesToExceptions="true"
    convertWarningsToExceptions="true"
    processIsolation="false"
    stopOnFailure="false"
>
    <coverage processUncoveredFiles="true">
        <include>
            <directory suffix=".php">../src/</directory>
        </include>
    </coverage>
    <testsuites>
        <testsuite name="Flarum Unit Tests">
            <directory suffix="Test.php">./unit</directory>
        </testsuite>
    </testsuites>
    <listeners>
        <listener class="\\Mockery\\Adapter\\Phpunit\\TestListener" />
    </listeners>
</phpunit>
`;

describe('modernizePhpunitXml', () => {
  const integration = modernizePhpunitXml('tests/phpunit.integration.xml', oldIntegration);
  const unit = modernizePhpunitXml('tests/phpunit.unit.xml', oldUnit);

  test('points the schema at the vendored phpunit, relative to the config', () => {
    expect(integration).toContain('xsi:noNamespaceSchemaLocation="../vendor/phpunit/phpunit/phpunit.xsd"');
    expect(integration).not.toContain('schema.phpunit.de');
  });

  test('a root-level config resolves the vendored schema without ../', () => {
    const root = modernizePhpunitXml('phpunit.xml', oldIntegration);
    expect(root).toContain('xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"');
  });

  test('drops the attributes PHPUnit 10 removed', () => {
    for (const gone of ['convertErrorsToExceptions', 'convertNoticesToExceptions', 'convertWarningsToExceptions', 'backupStaticAttributes']) {
      expect(integration).not.toContain(gone);
    }
  });

  test('renames backupStaticAttributes to backupStaticProperties, keeping the value', () => {
    expect(integration).toContain('backupStaticProperties="false"');
  });

  test('adds the cache directory and warning details display', () => {
    expect(integration).toContain('cacheDirectory=".phpunit.cache"');
    expect(integration).toContain('displayDetailsOnTestsThatTriggerWarnings="true"');
  });

  test('replaces the coverage element with source', () => {
    expect(integration).toContain('<source>');
    expect(integration).toContain('</source>');
    expect(integration).not.toContain('<coverage');
    expect(integration).not.toContain('processUncoveredFiles');
    // The include list survives inside <source>.
    expect(integration).toMatch(/<source>[\s\S]*<directory suffix="\.php">\.\.\/src\/<\/directory>[\s\S]*<\/source>/);
  });

  test('removes the listeners block PHPUnit 10 dropped', () => {
    expect(unit).not.toContain('<listeners>');
    expect(unit).not.toContain('Mockery\\Adapter');
  });

  test('preserves the testsuites and per-file settings verbatim', () => {
    expect(integration).toContain('<testsuite name="Flarum Integration Tests">');
    expect(integration).toContain('<exclude>./integration/tmp</exclude>');
    expect(integration).toContain('processIsolation="true"');
    expect(unit).toContain('processIsolation="false"');
    expect(unit).toContain('<testsuite name="Flarum Unit Tests">');
  });

  test('is idempotent on an already-modern config', () => {
    const once = modernizePhpunitXml('tests/phpunit.integration.xml', oldIntegration);
    const twice = modernizePhpunitXml('tests/phpunit.integration.xml', once);
    expect(twice).toBe(once);
  });
});
