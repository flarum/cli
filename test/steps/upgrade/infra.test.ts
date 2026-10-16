import Infrastructure from '../../../src/steps/upgrade/twopointoh/infra';

/**
 * The workflow as the upgrade writes it back.
 */
async function upgrade(code: string, file = '.github/workflows/backend.yml', branches: string[] = []): Promise<string> {
  const step = new Infrastructure({} as any, '/extension', 1, 1, false);
  jest.spyOn(step as any, 'hasBranch').mockImplementation(async (name) => branches.includes(name as string));
  const result = await step.applyReplacements(file, code, step.advancedContent(file, code));

  return result.updated as string;
}

// The backend workflow `fl init` gave a 1.x extension, with the PHP versions
// many extensions added to it.
const oneBackendWorkflow = `name: Acme Thing PHP

on: [workflow_dispatch, push, pull_request]

jobs:
  run:
    uses: flarum/framework/.github/workflows/REUSABLE_backend.yml@1.x
    with:
      enable_backend_testing: true
      php_versions: '["8.0", "8.1", "8.2"]'

      backend_directory: .
`;

describe('the infrastructure step', () => {
  it('points the reusable workflows at 2.x', async () => {
    const workflow = await upgrade(oneBackendWorkflow);

    expect(workflow).toContain('uses: flarum/framework/.github/workflows/REUSABLE_backend.yml@2.x');
  });

  it('leaves the PHP versions to the reusable workflow, which tests the ones Flarum 2.0 supports', async () => {
    const workflow = await upgrade(oneBackendWorkflow);

    expect(workflow).toBe(`name: Acme Thing PHP

on: [workflow_dispatch, push, pull_request]

jobs:
  run:
    uses: flarum/framework/.github/workflows/REUSABLE_backend.yml@2.x
    with:
      enable_backend_testing: true

      backend_directory: .
`);
  });

  it.each([
    ['double quotes', `php_versions: "[\\"8.1\\", \\"8.2\\"]"`],
    ['a trailing comment', `php_versions: '["8.1","8.2"]' # the versions we support`],
    ['a folded value', `php_versions: >-\n        ["8.1", "8.2"]`],
  ])('drops the PHP versions written with %s', async (_style, line) => {
    const workflow = await upgrade(`jobs:
  run:
    uses: flarum/framework/.github/workflows/REUSABLE_backend.yml@1.x
    with:
      enable_backend_testing: true
      ${line}
      backend_directory: .
`);

    expect(workflow).not.toContain('php_versions');
    expect(workflow).not.toContain('8.1');
    expect(workflow).toContain('      enable_backend_testing: true\n      backend_directory: .\n');
  });

  it('drops a `with:` the PHP versions were the only input of', async () => {
    const workflow = await upgrade(`jobs:
  run:
    uses: flarum/framework/.github/workflows/REUSABLE_backend.yml@1.x
    with:
      php_versions: '["8.0", "8.1"]'
    secrets:
      token: \${{ secrets.TOKEN }}
`);

    expect(workflow).toBe(`jobs:
  run:
    uses: flarum/framework/.github/workflows/REUSABLE_backend.yml@2.x
    secrets:
      token: \${{ secrets.TOKEN }}
`);
  });

  it('leaves a workflow without PHP versions as it was, apart from the branch', async () => {
    const frontend = `jobs:
  run:
    uses: flarum/framework/.github/workflows/REUSABLE_frontend.yml@1.x
    with:
      enable_bundlewatch: false
      frontend_directory: ./js
`;

    expect(await upgrade(frontend, '.github/workflows/frontend.yml')).toBe(frontend.replace('@1.x', '@2.x'));
  });

  describe('main_git_branch, the branch the built JS is committed to', () => {
    const frontend = `jobs:
  run:
    uses: flarum/framework/.github/workflows/REUSABLE_frontend.yml@1.x
    with:
      frontend_directory: ./js
      main_git_branch: 1.x
`;

    it('moves from 1.x to the 2.x branch', async () => {
      const workflow = await upgrade(frontend, '.github/workflows/frontend.yml', ['1.x', '2.x']);

      expect(workflow).toContain('      main_git_branch: 2.x\n');
      expect(workflow).not.toContain('@TODO');
    });

    it('keeps the quotes around it', async () => {
      const workflow = await upgrade(frontend.replace('main_git_branch: 1.x', "main_git_branch: '1.x'"), '.github/workflows/frontend.yml', ['2.x']);

      expect(workflow).toContain("      main_git_branch: '2.x'\n");
    });

    it('asks for the branch when there is no 2.x branch to point it at', async () => {
      const workflow = await upgrade(frontend, '.github/workflows/frontend.yml', ['1.x', 'main']);

      expect(workflow).toContain(
        '      # @TODO: Set main_git_branch to the branch your Flarum 2.x code is on. The built JS is committed to it.\n      main_git_branch: 1.x\n'
      );
    });

    it('asks only once when run again', async () => {
      const once = await upgrade(frontend, '.github/workflows/frontend.yml');

      expect(await upgrade(once, '.github/workflows/frontend.yml')).toBe(once);
    });

    it('leaves main alone, as 2.x code is often there', async () => {
      const onMain = frontend.replace('main_git_branch: 1.x', 'main_git_branch: main');

      expect(await upgrade(onMain, '.github/workflows/frontend.yml', ['2.x'])).toBe(onMain.replace('@1.x', '@2.x'));
    });
  });

  describe('js/tsconfig.json', () => {
    // The tsconfig.json `fl init` gave a 1.x extension.
    const oneTsConfig = `{
  // Use Flarum's tsconfig as a starting point
  "extends": "flarum-tsconfig",
  // This will match all .ts, .tsx, .d.ts, .js, .jsx files in your \`src\` folder
  // and also tells your Typescript server to read core's global typings for
  // access to \`dayjs\` and \`$\` in the global namespace.
  "include": ["src/**/*", "../vendor/flarum/core/js/dist-typings/@types/**/*"],
  "compilerOptions": {
    // This will output typings to \`dist-typings\`
    "declarationDir": "./dist-typings",
    "baseUrl": ".",
    "paths": {
      "flarum/*": ["../vendor/flarum/core/js/dist-typings/*"]
    }
  }
}
`;

    it('reads the global typings of every Flarum package in vendor, keeping the comments', async () => {
      const tsconfig = await upgrade(oneTsConfig, 'js/tsconfig.json');

      expect(tsconfig).toBe(
        oneTsConfig.replace('"../vendor/flarum/core/js/dist-typings/@types/**/*"', '"../vendor/*/*/js/dist-typings/@types/**/*"')
      );
    });

    it('does not add the root @types folder, which would move the built typings', async () => {
      expect(await upgrade(oneTsConfig, 'js/tsconfig.json')).not.toContain('"@types/**/*"');
    });

    it('leaves one that already reads them all as it was', async () => {
      const both = oneTsConfig.replace('"src/**/*",', '"src/**/*", "../vendor/*/*/js/dist-typings/@types/**/*",');

      expect(await upgrade(both, 'js/tsconfig.json')).toBe(both);
    });

    it('does not parse it, so one the JSON parser cannot read is no failure', async () => {
      const step = new Infrastructure({} as any, '/extension', 1, 1, false);

      expect(step.advancedContent('js/tsconfig.json', '{ /* a block comment */ }')).toBeNull();
    });
  });
});
