import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Config } from '@oclif/core';
import TwoPointOh from '../../../src/commands/upgrade/2.0';

/**
 * `upgrade 2.0 --json` is for a program driving the upgrade, such as an AI
 * agent: it asks nothing, and reports what each step did as JSON.
 */

const INFRASTRUCTURE = 3;
const MISC_FRONTEND = 7;

function git(root: string, command: string): string {
  return execSync(`git ${command}`, { cwd: root, encoding: 'utf8' }).trim();
}

/**
 * A 1.x extension, committed, as the upgrade requires.
 */
function extension(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-json-'));

  const files: Record<string, string> = {
    'composer.json': JSON.stringify({ name: 'acme/flarum-interstellar', require: { 'flarum/core': '^1.8' } }, null, 4),
    'extend.php': '<?php\n\nreturn [];\n',
    '.github/workflows/backend.yml': 'jobs:\n  run:\n    uses: flarum/framework/.github/workflows/REUSABLE_backend.yml@1.x\n',
    'js/src/forum/index.js': "import app from 'flarum/forum/app';\n\nif (app.initializers.has('someone-else')) {\n  console.log('both');\n}\n",
  };

  for (const [file, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), contents);
  }

  git(root, 'init -q');
  git(root, 'config user.name Test');
  git(root, 'config user.email test@example.com');
  git(root, 'add .');
  git(root, 'commit -qm init');

  return root;
}

async function upgrade(root: string, ...argv: string[]): Promise<{ report: any; exitCode: number }> {
  // As much of oclif's config as running a command uses. Loading the real
  // one would load every compiled command too.
  const config = { bin: 'flarum-cli', scopedEnvVarKey: (key: string) => `FLARUM_CLI_${key}` } as unknown as Config;
  const cwd = process.cwd();

  let out = '';
  const write = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    out += chunk.toString();
    return true;
  });

  try {
    await new TwoPointOh([root, '--json', ...argv], config)._run();
  } finally {
    write.mockRestore();
    // Steps run from the extension's root.
    process.chdir(cwd);
  }

  const exitCode = process.exitCode ?? 0;
  process.exitCode = undefined;

  return { report: JSON.parse(out), exitCode };
}

describe('upgrade 2.0 --json', () => {
  it('reports the commit a step made and its notes, and prints nothing else', async () => {
    const root = extension();

    const { report, exitCode } = await upgrade(root, '--step', String(INFRASTRUCTURE));

    expect(exitCode).toBe(0);
    expect(report).toStrictEqual({
      status: 'succeeded',
      error: null,
      messages: [],
      steps: [
        {
          step: INFRASTRUCTURE,
          title: 'Update the extension infrastructure.',
          status: 'committed',
          commit: { sha: git(root, 'rev-parse HEAD'), message: 'chore(2.0): update infrastructure' },
          notes: 'Infrastructure updated. Please review the changes then proceed.',
          todos: [],
        },
      ],
    });
  });

  it('lists the @TODOs a step left, with where they are', async () => {
    const root = extension();

    const { report } = await upgrade(root, '--step', String(MISC_FRONTEND));

    const [step] = report.steps;
    const index = fs.readFileSync(path.join(root, 'js/src/forum/index.js'), 'utf8').split('\n');

    expect(step.status).toBe('committed');
    expect(step.todos).toHaveLength(1);
    expect(step.todos[0].file).toBe('js/src/forum/index.js');
    expect(index[step.todos[0].line - 1].trim()).toBe(step.todos[0].text);
    expect(step.todos[0].text).toMatch(/^\/\/ @TODO: check whether the extension is enabled/);
  });

  it('skips a step that already ran', async () => {
    const root = extension();

    await upgrade(root, '--step', String(INFRASTRUCTURE));
    const { report } = await upgrade(root, '--step', String(INFRASTRUCTURE));

    expect(report.steps[0].status).toBe('skipped');
  });

  it('fails without changing anything when the tree has uncommitted changes', async () => {
    const root = extension();
    fs.appendFileSync(path.join(root, 'extend.php'), '// local edit\n');

    const { report, exitCode } = await upgrade(root);

    expect(exitCode).toBe(1);
    expect(report.status).toBe('failed');
    expect(report.error).toContain('uncommitted changes');
    expect(report.steps[0]).toMatchObject({ step: 1, status: 'failed', failures: [] });
    expect(report.steps.slice(1).every((step: any) => step.status === 'not-run')).toBe(true);
    expect(git(root, 'rev-list --count HEAD')).toBe('1');
  });

  it('reports an error from before any step as JSON too', async () => {
    const { report, exitCode } = await upgrade(fs.mkdtempSync(path.join(os.tmpdir(), 'not-an-extension-')));

    expect(exitCode).not.toBe(0);
    expect(report.status).toBe('failed');
    expect(report.error).toContain('is not located in a valid Flarum package');
    expect(report.steps).toStrictEqual([]);
  });
});
