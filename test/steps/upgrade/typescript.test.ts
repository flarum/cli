import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Dependencies from '../../../src/steps/upgrade/twopointoh/dependencies';

/**
 * Flarum builds and checks its typings with TypeScript 5.9, which
 * flarum-webpack-config 3.1 supplies to extensions. These tests pin how the
 * upgrade brings an extension's TypeScript in line with that.
 */

type Step = InstanceType<typeof Dependencies>;

const newStep = (): Step => new Dependencies({} as any, '/extension', 1, 1, false);

/** The file as the step writes it back. */
async function upgrade(step: Step, file: string, code: string): Promise<string> {
  const result = await step.applyReplacements(file, code, step.advancedContent(file, code));

  return result.updated as string;
}

// Read back as TypeScript reads it, comments and all.
const upgradeJson = async (step: Step, file: string, content: Record<string, any>) =>
  step.advancedContent(file, await upgrade(step, file, JSON.stringify(content, null, 2))) as Record<string, any>;

// What the step puts first in compilerOptions, at the given indentation.
const typesOption = (indent: string) =>
  `${indent}// Only load the type packages the code imports, not every one in\n${indent}// node_modules, such as the @types/node webpack brings along.\n${indent}"types": [],\n`;

/** An extension with the given js/package.json, for what the step reads from disk. */
function extensionWith(pkg: Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'typescript-'));

  fs.mkdirSync(path.join(root, 'js'));
  fs.writeFileSync(path.join(root, 'js/package.json'), JSON.stringify(pkg));

  return root;
}

/** An extension with the given js/package.json and js/tsconfig.json. */
function extensionWithTsConfig(pkg: Record<string, unknown>, tsconfig: Record<string, unknown>): string {
  const root = extensionWith(pkg);

  fs.writeFileSync(path.join(root, 'js/tsconfig.json'), JSON.stringify(tsconfig));

  return root;
}

const scaffolded = (file: string) => fs.readFileSync(path.resolve(__dirname, '../../../boilerplate/skeleton/extension', file), 'utf8');

// What `fl init` gave 1.x extensions, and core and every bundled extension
// still use. `sed -i` with no suffix is GNU sed's form; BSD sed, as on macOS,
// takes the next argument as the suffix and fails.
const gnuPostBuildTypings = "find dist-typings -type f -name '*.d.ts' -print0 | xargs -0 sed -i 's,../src/@types,@types,g'";

describe('TypeScript, which Flarum builds with at 5.9', () => {
  describe('the version', () => {
    it.each(['^4.5.4', '4.9.5', '~4.7.4', '^5.4.5', '~5.9.2'])('raises %s to the 5.9 Flarum builds with, without a note', async (constraint) => {
      const step = newStep();
      const pkg = await upgradeJson(step, 'js/package.json', { devDependencies: { typescript: constraint } });

      expect(pkg.devDependencies.typescript).toBe('^5.9.3');
      expect(step.pauseMessage()).not.toContain('brought down');
    });

    it('keeps the 5.9 a new extension is scaffolded with', async () => {
      const pkg = await upgradeJson(newStep(), 'js/package.json', { devDependencies: { typescript: '^5.9.3' } });

      expect(pkg.devDependencies.typescript).toBe('^5.9.3');
    });

    it.each(['^6.0.3', '^7.0.0', '>=4.2', 'latest', '*'])('brings %s, which allows TypeScript 6, down to 5.9, saying why', async (constraint) => {
      const step = newStep();
      const pkg = await upgradeJson(step, 'js/package.json', { devDependencies: { typescript: constraint } });

      expect(pkg.devDependencies.typescript).toBe('^5.9.3');
      expect(step.pauseMessage()).toContain(
        `TypeScript ${constraint} was brought down to ^5.9.3: flarum-tsconfig resolves modules the way TypeScript 6 refuses without ignoreDeprecations.`
      );
    });

    it.each(['bundler', 'NodeNext', 'node16'])(
      'keeps a TypeScript 6 or newer the tsconfig already resolves modules for, with moduleResolution %s',
      async (moduleResolution) => {
        const pkg = { devDependencies: { typescript: '^7.0.2' } };
        const root = extensionWithTsConfig(pkg, { extends: 'flarum-tsconfig', compilerOptions: { moduleResolution } });
        const step = new Dependencies({} as any, root, 1, 1, false);

        expect((await upgradeJson(step, 'js/package.json', pkg)).devDependencies.typescript).toBe('^7.0.2');
        expect(step.pauseMessage()).toContain('Kept, as they already ask for newer versions than Flarum 2.0 needs: typescript ^7.0.2.');
        expect(step.pauseMessage()).not.toContain('brought down');
      }
    );

    it('brings a TypeScript 6 or newer down when the tsconfig still sets baseUrl, which TypeScript 6 refuses', async () => {
      const pkg = { devDependencies: { typescript: '^7.0.2' } };
      const root = extensionWithTsConfig(pkg, { compilerOptions: { moduleResolution: 'bundler', baseUrl: '.' } });
      const step = new Dependencies({} as any, root, 1, 1, false);

      expect((await upgradeJson(step, 'js/package.json', pkg)).devDependencies.typescript).toBe('^5.9.3');
      expect(step.pauseMessage()).toContain('TypeScript ^7.0.2 was brought down to ^5.9.3');
    });

    it('is not added to an extension without it', async () => {
      const pkg = await upgradeJson(newStep(), 'js/package.json', { devDependencies: { prettier: '^2.5.1' } });

      expect(pkg.devDependencies).not.toHaveProperty('typescript');
    });

    it('is the version a new extension is scaffolded with', () => {
      expect(JSON.parse(scaffolded('js/package.json')).devDependencies.typescript).toBe('^5.9.3');
    });
  });

  describe('in tsconfig.json', () => {
    it('drops the compiler options, and values, TypeScript 5.9 refuses, and says so', async () => {
      const step = newStep();
      const tsconfig = await upgradeJson(step, 'js/tsconfig.json', {
        extends: 'flarum-tsconfig',
        include: ['src/**/*'],
        compilerOptions: {
          suppressImplicitAnyIndexErrors: true,
          keyofStringsOnly: true,
          importsNotUsedAsValues: 'error',
          target: 'ES3',
          lib: ['DOM', 'es2023'],
          declarationDir: './dist-typings',
          baseUrl: '.',
          paths: { 'flarum/*': ['../vendor/flarum/core/js/dist-typings/*'] },
        },
      });

      expect(tsconfig.compilerOptions).toEqual({
        types: [],
        lib: ['DOM', 'es2023'],
        declarationDir: './dist-typings',
        baseUrl: '.',
        paths: { 'flarum/*': ['../vendor/flarum/core/js/dist-typings/*'] },
      });
      expect(step.pauseMessage()).toContain(
        'Removed from js/tsconfig.json, as TypeScript 5.9 refuses them: suppressImplicitAnyIndexErrors, keyofStringsOnly, importsNotUsedAsValues, target "ES3".'
      );
    });

    it('keeps the options and values TypeScript 5.9 has, however they are written', async () => {
      const options = {
        target: 'ES2023',
        moduleResolution: 'Bundler',
        module: 'ESNext',
        jsx: 'preserve',
        verbatimModuleSyntax: true,
        allowImportingTsExtensions: true,
      };
      const tsconfig = await upgradeJson(newStep(), 'js/tsconfig.json', { compilerOptions: options });

      expect(tsconfig.compilerOptions).toEqual({ types: [], ...options });
    });

    it('leaves a tsconfig TypeScript 5.9 can read as it was, but for the type packages it loads', async () => {
      const step = newStep();
      const code = `{
  // Use Flarum's shared TypeScript settings.
  "extends": "flarum-tsconfig",
  "include": ["src/**/*"],
  "compilerOptions": {
    "declarationDir": "./dist-typings",
    "baseUrl": "."
  }
}
`;

      expect(await upgrade(step, 'js/tsconfig.json', code)).toBe(
        code.replace('  "compilerOptions": {\n', `  "compilerOptions": {\n${typesOption('    ')}`)
      );
      expect(step.pauseMessage()).not.toContain('tsconfig.json');
    });

    it('reads a tsconfig.json with trailing commas, as TypeScript does', async () => {
      // As fof/follow-tags and several other extensions have it.
      const code = `{
  "extends": "flarum-tsconfig",
  "include": [
    "src/**/*",
    "../vendor/flarum/core/js/dist-typings/@types/**/*",
  ],
  "compilerOptions": {
    "declarationDir": "./dist-typings",
  },
}
`;

      expect(await upgrade(newStep(), 'js/tsconfig.json', code)).toBe(
        code.replace('  "compilerOptions": {\n', `  "compilerOptions": {\n${typesOption('    ')}`)
      );
    });

    it('keeps the type packages a tsconfig already names', async () => {
      const code = `{\n  "compilerOptions": {\n    "types": ["mithril"]\n  }\n}\n`;

      expect(await upgrade(newStep(), 'js/tsconfig.json', code)).toBe(code);
    });

    it('leaves listing the type packages whose globals the code may use to do', async () => {
      const step = new Dependencies(
        {} as any,
        extensionWith({ devDependencies: { '@types/jquery': '^3.5.0', '@types/jest': '^29.0.0' } }),
        1,
        1,
        false
      );

      await upgrade(step, 'js/tsconfig.json', `{\n  "compilerOptions": {}\n}\n`);

      expect((step as any).followUps).toEqual([
        {
          file: 'js/tsconfig.json',
          line: null,
          text: 'It only loads the type packages the code imports now. If the code uses the globals of @types/jquery, list them in compilerOptions.types.',
        },
      ]);
    });

    it("loads Jest's globals in a test config, which would no longer get them from tsconfig.json", async () => {
      const step = new Dependencies({} as any, extensionWith({ devDependencies: { '@flarum/jest-config': '^2.0.0' } }), 1, 1, false);
      const code = `{\n    "extends": "./tsconfig.json",\n    "compilerOptions": {\n        "strict": false\n    }\n}\n`;

      expect(await upgrade(step, 'js/tsconfig.test.json', code)).toBe(
        `{\n    "extends": "./tsconfig.json",\n    "compilerOptions": {\n        "types": ["jest"],\n        "strict": false\n    }\n}\n`
      );
    });

    it('leaves a test config alone without Jest', async () => {
      const code = `{\n  "compilerOptions": {\n    "strict": false\n  }\n}\n`;

      expect(await upgrade(newStep(), 'js/tsconfig.test.json', code)).toBe(code);
    });

    it('is what a new extension is scaffolded with', async () => {
      const tsconfig = scaffolded('js/tsconfig.json');
      const test = scaffolded('js/tsconfig.test.json');

      expect(tsconfig).toContain(typesOption('    '));
      expect(test).toContain('"types": ["jest"]');
    });

    it('keeps a list of configs to extend, which TypeScript 5 reads', async () => {
      const step = newStep();
      const tsconfig = await upgradeJson(step, 'js/tsconfig.json', { extends: ['flarum-tsconfig', './tsconfig.paths.json'] });

      expect(tsconfig.extends).toEqual(['flarum-tsconfig', './tsconfig.paths.json']);
      expect((step as any).followUps).toEqual([]);
    });
  });

  describe('syntax TypeScript 5 added', () => {
    it('is left alone, as Flarum builds with TypeScript 5.9', () => {
      expect(newStep().replacements('js/src/forum/utils.ts')).toEqual([]);
    });

    it('is not looked for in the extension’s TypeScript', () => {
      const targets = newStep().targets();

      expect(targets).toEqual(expect.arrayContaining(['js/tsconfig.json']));
      expect(targets).not.toContain('js/src/**/*.ts');
    });
  });

  describe('post-build-typings', () => {
    it('is rewritten to work with BSD sed, as on macOS, as well as GNU sed', async () => {
      const pkg = await upgradeJson(newStep(), 'js/package.json', { scripts: { 'post-build-typings': gnuPostBuildTypings } });

      expect(pkg.scripts['post-build-typings']).toBe(
        "find dist-typings -type f -name '*.d.ts' -print0 | xargs -0 sed -i.bak 's,../src/@types,@types,g' && find dist-typings -type f -name '*.d.ts.bak' -delete"
      );
      expect(pkg.scripts['post-build-typings']).toBe(JSON.parse(scaffolded('js/package.json')).scripts['post-build-typings']);
    });

    it('is left alone when the extension wrote its own', async () => {
      const own = 'node scripts/fix-typings.js';
      const pkg = await upgradeJson(newStep(), 'js/package.json', { scripts: { 'post-build-typings': own } });

      expect(pkg.scripts['post-build-typings']).toBe(own);
    });

    it('rewrites the typings paths and leaves no backups, in a new extension', () => {
      const script = JSON.parse(scaffolded('js/package.json')).scripts['post-build-typings'];
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'post-build-typings-'));

      fs.mkdirSync(path.join(dir, 'dist-typings/forum'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'dist-typings/forum/index.d.ts'), "import '../src/@types/shims';\n");

      execSync(script, { cwd: dir, shell: '/bin/sh' });

      expect(fs.readFileSync(path.join(dir, 'dist-typings/forum/index.d.ts'), 'utf8')).toBe("import '@types/shims';\n");
      expect(fs.readdirSync(path.join(dir, 'dist-typings/forum'))).toEqual(['index.d.ts']);

      fs.rmSync(dir, { recursive: true });
    });
  });
});
