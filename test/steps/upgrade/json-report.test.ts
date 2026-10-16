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
const MISC_BACKEND = 9;
const EMAIL_VIEWS = 12;

/** A notification blueprint that is emailed with the given views. */
const mailableBlueprint = (views: string) => `<?php

namespace Acme\\Interstellar\\Notifications;

use Flarum\\Notification\\Blueprint\\BlueprintInterface;
use Flarum\\Notification\\MailableInterface;

class LaunchBlueprint implements BlueprintInterface, MailableInterface
{
    public function getEmailViews(): array
    {
        return [${views}];
    }
}
`;

function git(root: string, command: string): string {
  return execSync(`git ${command}`, { cwd: root, encoding: 'utf8' }).trim();
}

/**
 * A 1.x extension, committed, as the upgrade requires.
 */
function extension(extra: Record<string, string> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-json-'));

  const files: Record<string, string> = {
    'composer.json': JSON.stringify({ name: 'acme/flarum-interstellar', require: { 'flarum/core': '^1.8' } }, null, 4),
    'extend.php': '<?php\n\nreturn [];\n',
    '.github/workflows/backend.yml': 'jobs:\n  run:\n    uses: flarum/framework/.github/workflows/REUSABLE_backend.yml@1.x\n',
    'js/src/forum/index.js': "import app from 'flarum/forum/app';\n\nif (app.initializers.has('someone-else')) {\n  console.log('both');\n}\n",
    ...extra,
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

  it('lists the work a step left that no @TODO comment shows, with the file it is about', async () => {
    const root = extension({
      'js/src/forum/components/Avatar.js': "import AvatarEditor from 'flarum/forum/components/AvatarEditor';\n\nexport default AvatarEditor;\n",
    });

    const { report } = await upgrade(root, '--step', String(MISC_FRONTEND));

    const [step] = report.steps;

    expect(step.status).toBe('committed');
    expect(step.todos).toHaveLength(2);
    expect(step.todos[1]).toEqual({
      file: 'js/src/forum/components/Avatar.js',
      line: null,
      text: expect.stringContaining('user.hasUploadedAvatar()'),
    });
  });

  it('lists the work a step left when it changed nothing', async () => {
    const root = extension({
      'migrations/2021_01_01_000000_widen_coordinates.php':
        "<?php\n\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Database\\Schema\\Builder;\n\nreturn [\n    'up' => function (Builder $schema) {\n        $schema->table('acme_coordinates', function (Blueprint $table) {\n            $table->string('name', 200)->change();\n        });\n    },\n];\n",
    });

    const { report } = await upgrade(root, '--step', String(MISC_BACKEND));

    expect(report.steps[0]).toEqual({
      step: MISC_BACKEND,
      title: 'Miscellaneous backend changes.',
      status: 'no-changes',
      todos: [
        {
          file: 'migrations/2021_01_01_000000_widen_coordinates.php',
          line: null,
          text: expect.stringContaining("repeat the column's whole definition"),
        },
      ],
    });
  });

  describe('with --check', () => {
    it('reports what a step would change, with its diff', async () => {
      const root = extension();

      const { report, exitCode } = await upgrade(root, '--check', '--step', String(INFRASTRUCTURE));

      expect(exitCode).toBe(0);
      expect(report.check).toEqual({ commit: git(root, 'rev-parse HEAD'), uncommittedChangesLeftOut: false });
      expect(report.steps[0]).toMatchObject({
        step: INFRASTRUCTURE,
        status: 'would-change',
        files: ['.github/workflows/backend.yml'],
        notes: 'Infrastructure updated. Please review the changes then proceed.',
        todos: [],
      });
      expect(report.steps[0].diff).toContain('+    uses: flarum/framework/.github/workflows/REUSABLE_backend.yml@2.x');
      expect(report.steps[0]).not.toHaveProperty('commit');
    });

    it('changes nothing in the extension, and leaves no worktree or branch behind', async () => {
      const root = extension();
      const before = { head: git(root, 'rev-parse HEAD'), branches: git(root, 'branch --list'), worktrees: git(root, 'worktree list') };

      await upgrade(root, '--check');

      expect({ head: git(root, 'rev-parse HEAD'), branches: git(root, 'branch --list'), worktrees: git(root, 'worktree list') }).toEqual(before);
      expect(git(root, 'status --porcelain')).toBe('');
      expect(fs.readFileSync(path.join(root, '.github/workflows/backend.yml'), 'utf8')).toContain('REUSABLE_backend.yml@1.x');
    });

    it('runs steps an earlier upgrade already committed', async () => {
      const root = extension();

      await upgrade(root, '--step', String(INFRASTRUCTURE));
      git(root, 'reset -q --hard HEAD~1');
      git(root, `commit -q --allow-empty -m "chore(2.0): update infrastructure"`);

      const { report } = await upgrade(root, '--check', '--step', String(INFRASTRUCTURE));

      expect(report.steps[0].status).toBe('would-change');
    });

    it('checks the last commit of an extension with changes not committed, and says it left them out', async () => {
      const root = extension();
      fs.appendFileSync(path.join(root, 'extend.php'), '// local edit\n');

      const { report, exitCode } = await upgrade(root, '--check', '--step', String(INFRASTRUCTURE));

      expect(exitCode).toBe(0);
      expect(report.check.uncommittedChangesLeftOut).toBe(true);
      expect(report.steps[0].status).toBe('would-change');
      expect(fs.readFileSync(path.join(root, 'extend.php'), 'utf8')).toContain('// local edit');
    });
  });

  describe('email views', () => {
    it("wraps a 1.x notification's one view as both, in place of it", async () => {
      const root = extension({
        'src/Notifications/LaunchBlueprint.php': mailableBlueprint("'text' => 'acme-interstellar::emails.launch'"),
        'resources/views/emails/launch.blade.php': 'Liftoff!\n',
      });

      const { report } = await upgrade(root, '--step', String(EMAIL_VIEWS));

      expect(report.steps[0].status).toBe('committed');
      expect(fs.existsSync(path.join(root, 'resources/views/emails/launch.blade.php'))).toBe(false);
      expect(fs.readFileSync(path.join(root, 'resources/views/email/plain/launch.blade.php'), 'utf8')).toContain(
        '<x-mail::plain.notification>\n<x-slot:body>\nLiftoff!'
      );
      expect(fs.readFileSync(path.join(root, 'resources/views/email/html/launch.blade.php'), 'utf8')).toContain('<x-mail::html.notification>');
      expect(fs.readFileSync(path.join(root, 'src/Notifications/LaunchBlueprint.php'), 'utf8')).toContain(
        "'text' => 'acme-interstellar::email.plain.launch'"
      );
    });

    it('leaves a notification that has both alone', async () => {
      // As fof/follow-users' 2.x notifications have them.
      const root = extension({
        'src/Notifications/LaunchBlueprint.php': mailableBlueprint(
          "'text' => 'acme-interstellar::email.plain.launch', 'html' => 'acme-interstellar::email.html.launch'"
        ),
        'resources/views/email/plain/launch.blade.php':
          '<x-mail::plain.notification>\n<x-slot:body>\nLiftoff!\n</x-slot:body>\n</x-mail::plain.notification>\n',
        'resources/views/email/html/launch.blade.php':
          '<x-mail::html.notification>\n    <x-slot:body>\n        Liftoff!\n    </x-slot:body>\n</x-mail::html.notification>\n',
      });

      const { report } = await upgrade(root, '--step', String(EMAIL_VIEWS));

      expect(report.steps[0].status).toBe('no-changes');
      expect(git(root, 'status --porcelain')).toBe('');
    });
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
