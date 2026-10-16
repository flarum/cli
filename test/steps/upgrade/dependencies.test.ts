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

/**
 * The package.json as the upgrade writes it back, for an extension with or
 * without a tsconfig.json, using the given package manager.
 */
async function withTypings(content: Record<string, any>, { tsconfig = true, packageManager = 'yarn' } = {}) {
  const step = new Dependencies({} as any, '/extension', 1, 1, false);
  jest.spyOn(step as any, 'hasTsConfig').mockReturnValue(tsconfig);
  jest.spyOn(step as any, 'packageManager').mockReturnValue(packageManager);

  const code = JSON.stringify(content, null, 2);
  const result = await step.applyReplacements('js/package.json', code, step.advancedContent('js/package.json', code));

  return { pkg: JSON.parse(result.updated as string), notes: step.pauseMessage(), todos: (step as any).followUps };
}

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

    it('keeps a PHP constraint newer than Flarum 2.0 needs', async () => {
      const composer = await upgrade('composer.json', { ...oneComposerJson, require: { ...oneComposerJson.require, php: '^8.4' } });

      expect(composer.require.php).toBe('^8.4');
    });

    it('keeps a Flarum constraint that already asks for a later 2.x release', async () => {
      const composer = await upgrade('composer.json', {
        require: { 'flarum/core': '^2.0.1' },
        'require-dev': { 'flarum/testing': '^2.0.1', 'flarum/phpstan': '^2.0.0' },
      });

      expect(composer.require['flarum/core']).toBe('^2.0.1');
      expect(composer['require-dev']['flarum/testing']).toBe('^2.0.1');
    });

    it('still replaces a constraint it cannot compare', async () => {
      const composer = await upgrade('composer.json', { require: { 'flarum/core': '*' }, 'require-dev': { 'flarum/core': '*@dev' } });

      expect(composer.require['flarum/core']).toBe('^2.0.0');
      expect(composer['require-dev']['flarum/core']).toBe('^2.0.0');
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

      expect(pkg.devDependencies['flarum-webpack-config']).toBe('^3.0.6');
      expect(pkg.devDependencies['flarum-tsconfig']).toBe('^2.0.0');
    });

    it('requires flarum-webpack-config 3.0.6, which loads code-split chunks from the right build', async () => {
      const pkg = await upgrade('js/package.json', { devDependencies: { 'flarum-webpack-config': '^3.0.0' } });

      expect(pkg.devDependencies['flarum-webpack-config']).toBe('^3.0.6');
    });

    it('requires the webpack Flarum builds with', async () => {
      const pkg = await upgrade('js/package.json', onePackageJson);

      expect(pkg.devDependencies.webpack).toBe('^5.104.1');
    });

    it('keeps tooling the extension already asks for newer versions of, and says so', async () => {
      const step = new Dependencies({} as any, '/extension', 1, 1, false);
      const code = JSON.stringify({ devDependencies: { 'webpack-cli': '^5.1.4', webpack: '^5.65.0' } }, null, 2);
      const result = await step.applyReplacements('js/package.json', code, step.advancedContent('js/package.json', code));
      const pkg = JSON.parse(result.updated as string);

      expect(pkg.devDependencies['webpack-cli']).toBe('^5.1.4');
      expect(pkg.devDependencies.webpack).toBe('^5.104.1');
      expect(step.pauseMessage()).toContain('webpack-cli ^5.1.4');
    });

    it('moves the build tooling to devDependencies, and says so', async () => {
      const step = new Dependencies({} as any, '/extension', 1, 1, false);
      const code = JSON.stringify(onePackageJson, null, 2);
      const result = await step.applyReplacements('js/package.json', code, step.advancedContent('js/package.json', code));
      const pkg = JSON.parse(result.updated as string);

      expect(pkg.dependencies).toEqual({});
      expect(Object.keys(pkg.devDependencies)).toEqual([
        '@flarum/prettier-config',
        'flarum-tsconfig',
        'flarum-webpack-config',
        'prettier',
        'webpack',
        'webpack-cli',
      ]);
      expect(step.pauseMessage()).toContain(
        'Moved to devDependencies, as the extension only builds with them: flarum-webpack-config, webpack, webpack-cli.'
      );
    });

    it('moves type packages to devDependencies', async () => {
      const pkg = await upgrade('js/package.json', { dependencies: { '@types/mithril': '^2.0.8' } });

      expect(pkg.devDependencies['@types/mithril']).toBe('^2.0.8');
      expect(pkg.dependencies).not.toHaveProperty('@types/mithril');
    });

    it('leaves the libraries the bundle may include in dependencies', async () => {
      const pkg = await upgrade('js/package.json', { dependencies: { 'flarum-webpack-config': '^2.0.0', 'emoji-mart': '^5.6.0' } });

      expect(pkg.dependencies).toEqual({ 'emoji-mart': '^5.6.0' });
    });

    it('keeps the newer constraint of tooling listed under both keys', async () => {
      const pkg = await upgrade('js/package.json', {
        dependencies: { 'flarum-webpack-config': '^2.0.0', prettier: '^3.0.3' },
        devDependencies: { 'flarum-webpack-config': '^2.0.0', prettier: '^2.5.1' },
      });

      expect(pkg.dependencies).toEqual({});
      expect(pkg.devDependencies).toEqual({ 'flarum-webpack-config': '^3.0.6', prettier: '^3.0.3' });
    });

    it('still drops a devDependency the extension also lists as a dependency, when it is not tooling', async () => {
      const pkg = await upgrade('js/package.json', {
        dependencies: { 'emoji-mart': '^5.6.0' },
        devDependencies: { 'emoji-mart': '^5.0.0', prettier: '^2.5.1' },
      });

      expect(pkg.dependencies['emoji-mart']).toBe('^5.6.0');
      expect(pkg.devDependencies).not.toHaveProperty('emoji-mart');
    });

    it('handles a package.json without dependencies', async () => {
      const pkg = await upgrade('js/package.json', { name: '@acme/thing', private: true });

      expect(pkg.name).toBe('@acme/thing');
    });

    it('brings the tooling to the versions a new extension is scaffolded with', async () => {
      const scaffolded = scaffoldedPackageJson().devDependencies;
      const tooling = ['flarum-webpack-config', 'flarum-tsconfig', '@flarum/jest-config', 'webpack', 'webpack-cli', 'typescript'];

      const pkg = await upgrade('js/package.json', {
        devDependencies: Object.fromEntries(tooling.map((name) => [name, '^0.0.1'])),
      });

      for (const name of tooling) {
        expect([name, pkg.devDependencies[name]]).toEqual([name, scaffolded[name]]);
      }
    });
  });

  describe('the scripts that build and check typings', () => {
    const typings = ['clean-typings', 'build-typings', 'post-build-typings', 'check-typings', 'check-typings-coverage'];

    it('adds the ones a new extension is scaffolded with, and what they run', async () => {
      const scaffolded = scaffoldedPackageJson();
      const { pkg, notes } = await withTypings(onePackageJson);

      for (const name of typings) {
        expect([name, pkg.scripts[name]]).toEqual([name, scaffolded.scripts[name].replace(/<%= params\.jsPackageManager %>/g, 'yarn')]);
      }

      expect(pkg.devDependencies.typescript).toBe('^4.9.5');
      expect(pkg.devDependencies['typescript-coverage-report']).toBe(scaffolded.devDependencies['typescript-coverage-report']);
      expect(notes).toContain(
        'build and check typings: clean-typings, build-typings, post-build-typings, check-typings, check-typings-coverage, typescript, typescript-coverage-report.'
      );
    });

    it('runs them with the package manager the extension uses', async () => {
      const { pkg } = await withTypings(onePackageJson, { packageManager: 'npm' });

      expect(pkg.scripts['build-typings']).toContain('npm run clean-typings');
      expect(pkg.scripts['build-typings']).not.toContain('yarn');
    });

    it('keeps the scripts the extension already has', async () => {
      const { pkg } = await withTypings({ ...onePackageJson, scripts: { build: 'webpack --mode production', 'check-typings': 'tsc --noEmit' } });

      expect(pkg.scripts.build).toBe('webpack --mode production');
      expect(pkg.scripts['check-typings']).toBe('tsc --noEmit');
      expect(pkg.scripts).toHaveProperty('check-typings-coverage');
    });

    it('keeps the TypeScript the extension lists, wherever it lists it', async () => {
      const { pkg } = await withTypings({ dependencies: { typescript: '^4.5.4' } });

      expect(pkg.devDependencies.typescript).toBe('^4.9.5');
      expect(pkg.dependencies).not.toHaveProperty('typescript');
    });

    it('adds nothing to an extension that has them all', async () => {
      const scaffolded = scaffoldedPackageJson();
      const scripts = Object.fromEntries(typings.map((name) => [name, scaffolded.scripts[name]]));
      const { pkg, notes } = await withTypings({ scripts, devDependencies: { prettier: '^2.5.1' } });

      expect(pkg.devDependencies).toEqual({ prettier: '^2.5.1' });
      expect(notes).not.toContain('build and check typings');
    });

    it('adds none without a tsconfig.json to check against, and leaves that to do', async () => {
      const { pkg, todos } = await withTypings(onePackageJson, { tsconfig: false });

      expect(pkg.scripts).toBeUndefined();
      expect(pkg.devDependencies).not.toHaveProperty('typescript');
      expect(todos).toEqual([
        {
          file: 'js/tsconfig.json',
          line: null,
          text: 'Add a tsconfig.json, then the scripts that build and check typings, which the reusable frontend workflow runs: clean-typings, build-typings, post-build-typings, check-typings, check-typings-coverage.',
        },
      ]);
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
