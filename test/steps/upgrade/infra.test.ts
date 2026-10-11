import Infrastructure from '../../../src/steps/upgrade/twopointoh/infra';

/**
 * The workflow as the upgrade writes it back.
 */
async function upgrade(code: string, file = '.github/workflows/backend.yml'): Promise<string> {
  const step = new Infrastructure({} as any, '/extension', 1, 1, false);
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
});
