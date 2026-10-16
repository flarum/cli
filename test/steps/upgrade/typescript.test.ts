import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Dependencies from '../../../src/steps/upgrade/twopointoh/dependencies';

/**
 * Flarum 2.0 builds and checks its typings with TypeScript 4.9 (core's
 * `^4.5.4` resolves to 4.9.5). These tests pin how the upgrade brings an
 * extension's TypeScript in line with that.
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
  `${indent}// Only load the type packages the code imports. Others, such as the\n${indent}// @types/node webpack brings along, use syntax TypeScript 4.9 can't read.\n${indent}"types": [],\n`;

/** An extension with the given js/package.json, for what the step reads from disk. */
function extensionWith(pkg: Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'typescript-'));

  fs.mkdirSync(path.join(root, 'js'));
  fs.writeFileSync(path.join(root, 'js/package.json'), JSON.stringify(pkg));

  return root;
}

const scaffolded = (file: string) => fs.readFileSync(path.resolve(__dirname, '../../../boilerplate/skeleton/extension', file), 'utf8');

// What `fl init` gave 1.x extensions, and core and every bundled extension
// still use. `sed -i` with no suffix is GNU sed's form; BSD sed, as on macOS,
// takes the next argument as the suffix and fails.
const gnuPostBuildTypings = "find dist-typings -type f -name '*.d.ts' -print0 | xargs -0 sed -i 's,../src/@types,@types,g'";

describe('TypeScript, which Flarum 2.0 builds with at 4.9', () => {
  describe('the version', () => {
    it('is the 4.9 Flarum builds with', async () => {
      const pkg = await upgradeJson(newStep(), 'js/package.json', { devDependencies: { typescript: '^4.5.4' } });

      expect(pkg.devDependencies.typescript).toBe('^4.9.5');
    });

    it('comes down from TypeScript 5, saying why', async () => {
      const step = newStep();
      const pkg = await upgradeJson(step, 'js/package.json', { devDependencies: { typescript: '^5.4.5' } });

      expect(pkg.devDependencies.typescript).toBe('^4.9.5');
      expect(step.pauseMessage()).toContain(
        'TypeScript ^5.4.5 was brought down to ^4.9.5: Flarum 2.0 builds and checks its typings with TypeScript 4.9.'
      );
    });

    it('says nothing about a 4.x it only moved to 4.9', async () => {
      const step = newStep();
      await upgradeJson(step, 'js/package.json', { devDependencies: { typescript: '^4.5.4' } });

      expect(step.pauseMessage()).not.toContain('brought down');
    });

    it.each([
      ['4.9.5', false],
      ['~4.7.4', false],
      ['4.x', false],
      ['^5.0.0', true],
      ['>=4.2', true],
      ['latest', true],
    ])('says why it changed %s only when that could have been a TypeScript 5', async (constraint, says) => {
      const step = newStep();
      await upgradeJson(step, 'js/package.json', { devDependencies: { typescript: constraint } });

      expect(step.pauseMessage().includes(`TypeScript ${constraint} was brought down`)).toBe(says);
    });

    it('is not added to an extension without it', async () => {
      const pkg = await upgradeJson(newStep(), 'js/package.json', { devDependencies: { prettier: '^2.5.1' } });

      expect(pkg.devDependencies).not.toHaveProperty('typescript');
    });

    it('is the version a new extension is scaffolded with', () => {
      expect(JSON.parse(scaffolded('js/package.json')).devDependencies.typescript).toBe('^4.9.5');
    });
  });

  describe('in tsconfig.json', () => {
    it('drops the compiler options TypeScript 4.9 does not have, and says so', async () => {
      const step = newStep();
      const tsconfig = await upgradeJson(step, 'js/tsconfig.json', {
        extends: 'flarum-tsconfig',
        include: ['src/**/*'],
        compilerOptions: {
          moduleResolution: 'bundler',
          verbatimModuleSyntax: true,
          allowImportingTsExtensions: true,
          target: 'ES2023',
          lib: ['DOM', 'es2023'],
          declarationDir: './dist-typings',
          baseUrl: '.',
          paths: { 'flarum/*': ['../vendor/flarum/core/js/dist-typings/*'] },
        },
      });

      expect(tsconfig.compilerOptions).toEqual({
        types: [],
        lib: ['DOM'],
        declarationDir: './dist-typings',
        baseUrl: '.',
        paths: { 'flarum/*': ['../vendor/flarum/core/js/dist-typings/*'] },
      });
      expect(step.pauseMessage()).toContain(
        'Removed from js/tsconfig.json, as TypeScript 4.9 does not have them: moduleResolution "bundler", verbatimModuleSyntax, allowImportingTsExtensions, target "ES2023", lib "es2023".'
      );
    });

    it('keeps the values TypeScript 4.9 has, however they are written', async () => {
      const tsconfig = await upgradeJson(newStep(), 'js/tsconfig.json', {
        compilerOptions: { target: 'ESNext', moduleResolution: 'Node', module: 'ES2020', jsx: 'preserve' },
      });

      expect(tsconfig.compilerOptions).toEqual({ types: [], target: 'ESNext', moduleResolution: 'Node', module: 'ES2020', jsx: 'preserve' });
    });

    it('leaves a tsconfig TypeScript 4.9 can read as it was, but for the type packages it loads', async () => {
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

    it('flags a list of configs to extend, which TypeScript 4.9 cannot read', async () => {
      const step = newStep();
      const tsconfig = await upgradeJson(step, 'js/tsconfig.json', { extends: ['flarum-tsconfig', './tsconfig.paths.json'] });

      expect(tsconfig.extends).toEqual(['flarum-tsconfig', './tsconfig.paths.json']);
      expect((step as any).followUps).toEqual([
        {
          file: 'js/tsconfig.json',
          line: null,
          text: 'It extends a list of configs, which TypeScript 4.9 cannot read. Extend one, and move the rest into it.',
        },
      ]);
    });
  });

  describe('syntax TypeScript 4.9 cannot compile', () => {
    const todo = (what: string) => `// @TODO: Flarum 2.0 builds with TypeScript 4.9, which has no ${what}.`;

    it('is flagged where it is used, and nothing else changes', async () => {
      const step = newStep();
      const code = `import data from './data.json' with { type: 'json' };
export type * from './types';

export function first<const T extends readonly unknown[]>(items: T) {
  using handle = open();

  return items[0];
}
`;

      expect(await upgrade(step, 'js/src/forum/utils.ts', code)).toBe(`${todo('import attributes (TypeScript 5.3); use `assert` instead of `with`')}
import data from './data.json' with { type: 'json' };
${todo('`export type *` (TypeScript 5.0)')}
export type * from './types';

${todo('`const` type parameters (TypeScript 5.0)')}
export function first<const T extends readonly unknown[]>(items: T) {
  ${todo('`using` declarations (TypeScript 5.2)')}
  using handle = open();

  return items[0];
}
`);
      expect(step.pauseMessage()).toContain('Some TypeScript uses syntax 4.9 cannot compile; look for the @TODO comments.');
    });

    it('leaves what TypeScript 4.9 has alone', async () => {
      const step = newStep();
      const code = `import data from './data.json' assert { type: 'json' };

@decorate
export class Thing {
  accessor count = 0;
  settings = { a: 1 } satisfies Record<string, number>;
}
`;

      expect(await upgrade(step, 'js/src/forum/Thing.tsx', code)).toBe(code);
      expect(step.pauseMessage()).not.toContain('@TODO');
    });

    it('is flagged once, however often the step runs', async () => {
      const code = `export function first<const T>(item: T) {
  return item;
}
`;
      const once = await upgrade(newStep(), 'js/src/forum/utils.ts', code);

      expect(once.match(/@TODO/g)).toHaveLength(1);
      expect(await upgrade(newStep(), 'js/src/forum/utils.ts', once)).toBe(once);
    });

    it('is looked for in the extension’s TypeScript', () => {
      expect(newStep().targets()).toEqual(expect.arrayContaining(['js/tsconfig.json', 'js/src/**/*.ts', 'js/src/**/*.tsx']));
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
