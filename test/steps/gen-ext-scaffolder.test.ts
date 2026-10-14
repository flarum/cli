import { genExtScaffolder, licenseTextFor } from '../../src/steps/gen-ext-scaffolder';

describe('genExtScaffolder', function () {
  it('validates', async function () {
    const scaffolder = genExtScaffolder();

    await scaffolder.validate();
  });
});

describe('licenseTextFor', function () {
  it('returns the SPDX text for a known licence', function () {
    expect(licenseTextFor('MIT')).toContain('Permission is hereby granted');
  });

  it('matches SPDX identifiers case-insensitively', function () {
    expect(licenseTextFor('mit')).toBe(licenseTextFor('MIT'));
  });

  it.each(['proprietary', 'PROPRIETARY', '© Glowing Blue AG', '', undefined, ['MIT', 'GPL-3.0-only']])(
    'returns an empty string for %p',
    function (license) {
      expect(licenseTextFor(license)).toBe('');
    }
  );
});
