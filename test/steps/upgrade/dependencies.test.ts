import fs from 'fs';
import path from 'path';
import Dependencies from '../../../src/steps/upgrade/twopointoh/dependencies';

/**
 * The file as the upgrade writes it back, parsed.
 */
async function upgrade(file: string, content: Record<string, any>): Promise<Record<string, any>> {
  const step = new Dependencies({} as any, '/extension', 1, 1, false);
  const code = JSON.stringify(content, null, 4);
  const result = await step.applyReplacements(file, code, step.advancedContent(file, code));

  return JSON.parse(result.updated as string);
}

/**
 * The package.json `fl init` gives a new extension. EJS placeholders only
 * appear inside strings, so it parses as JSON.
 */
function scaffoldedPackageJson(): Record<string, any> {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../boilerplate/skeleton/extension/js/package.json'), 'utf8'));
}

// The composer.json `fl init` gave a 1.x extension.
const oneComposerJson = {
  name: 'acme/thing',
  type: 'flarum-extension',
  require: {
    php: '^8.0',
    'flarum/core': '^1.2.0',
    'flarum/tags': '^1.0',
  },
  'require-dev': {
    'flarum/testing': '^1.0.0',
  },
};

// The package.json `fl init` gave a 1.x extension, with the build tooling
// split between dependencies and devDependencies as many extensions have it.
const onePackageJson = {
  name: '@acme/thing',
  private: true,
  dependencies: {
    'flarum-webpack-config': '^2.0.0',
    webpack: '^5.65.0',
    'webpack-cli': '^4.9.1',
  },
  devDependencies: {
    '@flarum/prettier-config': '^1.0.0',
    'flarum-tsconfig': '^1.0.2',
    prettier: '^2.5.1',
  },
};

describe('the dependencies step', () => {
  describe('in composer.json', () => {
    it('requires Flarum 2.0 and PHP 8.3', async () => {
      const composer = await upgrade('composer.json', oneComposerJson);

      expect(composer.require['flarum/core']).toBe('^2.0.0');
      expect(composer.require.php).toBe('^8.3');
      expect(composer.require['flarum/tags']).toBe('*');
      expect(composer['require-dev']['flarum/testing']).toBe('^2.0.0');
    });

    it('does not lower the minimum stability, now that Flarum 2.0 is stable', async () => {
      const composer = await upgrade('composer.json', oneComposerJson);

      expect(composer).not.toHaveProperty('minimum-stability');
      expect(composer).not.toHaveProperty('prefer-stable');
    });

    it('leaves the stability settings the extension already has', async () => {
      const composer = await upgrade('composer.json', { ...oneComposerJson, 'minimum-stability': 'dev', 'prefer-stable': true });

      expect(composer['minimum-stability']).toBe('dev');
      expect(composer['prefer-stable']).toBe(true);
    });
  });

  describe('in package.json', () => {
    it('updates the build tooling in both dependencies and devDependencies', async () => {
      const pkg = await upgrade('js/package.json', onePackageJson);

      expect(pkg.dependencies['flarum-webpack-config']).toBe('^3.0.6');
      expect(pkg.devDependencies['flarum-tsconfig']).toBe('^2.0.0');
    });

    it('requires flarum-webpack-config 3.0.6, which loads code-split chunks from the right build', async () => {
      const pkg = await upgrade('js/package.json', { devDependencies: { 'flarum-webpack-config': '^3.0.0' } });

      expect(pkg.devDependencies['flarum-webpack-config']).toBe('^3.0.6');
    });

    it('requires the webpack Flarum builds with', async () => {
      const pkg = await upgrade('js/package.json', onePackageJson);

      expect(pkg.dependencies.webpack).toBe('^5.104.1');
    });

    it('drops a devDependency the extension also lists as a dependency', async () => {
      const pkg = await upgrade('js/package.json', {
        dependencies: { 'flarum-webpack-config': '^2.0.0' },
        devDependencies: { 'flarum-webpack-config': '^2.0.0', prettier: '^2.5.1' },
      });

      expect(pkg.dependencies['flarum-webpack-config']).toBe('^3.0.6');
      expect(pkg.devDependencies).not.toHaveProperty('flarum-webpack-config');
    });

    it('handles a package.json without dependencies', async () => {
      const pkg = await upgrade('js/package.json', { name: '@acme/thing', private: true });

      expect(pkg.name).toBe('@acme/thing');
    });

    it('brings the tooling to the versions a new extension is scaffolded with', async () => {
      const scaffolded = scaffoldedPackageJson().devDependencies;
      const tooling = ['flarum-webpack-config', 'flarum-tsconfig', '@flarum/jest-config', 'webpack', 'webpack-cli'];

      const pkg = await upgrade('js/package.json', {
        devDependencies: Object.fromEntries(tooling.map((name) => [name, '^0.0.1'])),
      });

      for (const name of tooling) {
        expect([name, pkg.devDependencies[name]]).toEqual([name, scaffolded[name]]);
      }
    });
  });

  describe('a new extension', () => {
    it('is scaffolded with flarum-webpack-config 3.0.6 and the webpack Flarum builds with', () => {
      const scaffolded = scaffoldedPackageJson().devDependencies;

      expect(scaffolded['flarum-webpack-config']).toBe('^3.0.6');
      expect(scaffolded.webpack).toBe('^5.104.1');
    });
  });
});
