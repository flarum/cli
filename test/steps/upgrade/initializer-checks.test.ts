import fs from 'fs';
import os from 'os';
import path from 'path';
import MiscFrontendChanges from '../../../src/steps/upgrade/twopointoh/frontend/misc';
import { formatCode } from '../../../src/utils/ast';

/**
 * In 1.x, code checked whether another extension was enabled with
 * app.initializers.has(name). Initializer names are not always the extension's
 * ID, and some of core's changed in 2.0, so the upgrade checks the extension's
 * ID in flarum.extensions instead, where it knows the ID for certain.
 */

function extension(composer: Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'initializer-checks-'));

  fs.writeFileSync(path.join(root, 'composer.json'), JSON.stringify({ name: 'acme/flarum-interstellar', ...composer }));

  return root;
}

async function upgrade(code: string, composer: Record<string, unknown> = {}, file = 'js/src/forum/index.ts'): Promise<string> {
  const step = new MiscFrontendChanges({} as any, extension(composer), 1, 1, false);
  const result = await step.applyReplacements(file, code, step.advancedContent(file, code));

  return result.updated as string;
}

const format = (code: string) => formatCode(code);

const todo =
  "// @TODO: check whether the extension is enabled with '<its extension ID>' in flarum.extensions instead (https://docs.flarum.org/2.x/extend/extending-extensions). An initializer is not always named after its extension, and some were renamed in 2.0.";

describe('checking whether another extension is enabled', () => {
  it("uses a bundled extension's ID", async () => {
    // As fof/sitemap's 1.x forum has it.
    expect(
      await upgrade(`import app from 'flarum/forum/app';

if (app.initializers.has('flarum-tags')) {
  console.log('tags');
}
`)
    ).toBe(
      await format(`import app from 'flarum/forum/app';

if ('flarum-tags' in flarum.extensions) {
  console.log('tags');
}
`)
    );
  });

  it('reads a file that exports from an ambient module', async () => {
    // Valid TypeScript, which Babel reports as an undeclared export unless it
    // is told not to check.
    expect(
      await upgrade(`declare module 'acme-shims' {
  const shim: string;
  export { shim };
}

if (app.initializers.has('flarum-tags')) {
  console.log('tags');
}
`)
    ).toBe(
      await format(`declare module 'acme-shims' {
  const shim: string;
  export { shim };
}

if ('flarum-tags' in flarum.extensions) {
  console.log('tags');
}
`)
    );
  });

  it('uses the IDs of the bundled extensions whose initializers 2.0 renamed', async () => {
    // fof/username-request's 1.x forum checks 'flarum/nicknames', which 2.0
    // renamed 'flarum-nicknames', so the check is false in 2.0.
    expect(
      await upgrade(`const nicknames = app.initializers.has('flarum/nicknames');
const lock = app.initializers.has('lock');
const subscriptions = app.initializers.has("subscriptions");
`)
    ).toBe(
      await format(`const nicknames = 'flarum-nicknames' in flarum.extensions;
const lock = 'flarum-lock' in flarum.extensions;
const subscriptions = 'flarum-subscriptions' in flarum.extensions;
`)
    );
  });

  it('uses the ID of an extension the composer.json names, by its ID or its package name', async () => {
    // As ianm/follow-users' and fof/drafts' 1.x forums have it.
    const composer = {
      require: { 'flarum/core': '^1.8', 'fof/follow-tags': '*' },
      'require-dev': { 'clarkwinkelmann/flarum-ext-author-change': '*' },
      suggest: { 'fof/user-directory': 'Lists users' },
      extra: { 'flarum-extension': { 'optional-dependencies': ['fof/byobu'] } },
    };

    expect(
      await upgrade(
        `const tags = app.initializers.has('fof/follow-tags');
const directory = app.initializers.has('fof-user-directory');
const byobu = app.initializers.has('fof-byobu');
const author = app.initializers.has('clarkwinkelmann-author-change');
`,
        composer
      )
    ).toBe(
      await format(`const tags = 'fof-follow-tags' in flarum.extensions;
const directory = 'fof-user-directory' in flarum.extensions;
const byobu = 'fof-byobu' in flarum.extensions;
const author = 'clarkwinkelmann-author-change' in flarum.extensions;
`)
    );
  });

  it('keeps what the check meant, whatever it is part of', async () => {
    expect(
      await upgrade(`const shown = !app.initializers.has('flarum-tags') && app.initializers.has('flarum-sticky') ? 1 : 2;
`)
    ).toBe(
      await format(`const shown = !('flarum-tags' in flarum.extensions) && 'flarum-sticky' in flarum.extensions ? 1 : 2;
`)
    );
  });

  it('leaves a check on an extension whose ID it cannot know, with a @TODO above its statement', async () => {
    // As datlechin/flarum-scroll-buttons' 1.x forum has it: neither extension
    // is in its composer.json. The @TODO goes above the statement, not inside
    // the JSX, where it would show.
    const code = `export default function view() {
  return (
    <div>
      {app.initializers.has('acpl/mobile-tab') && app.initializers.has('itnt-uitab') ? <span /> : null}
    </div>
  );
}
`;

    expect(await upgrade(code, {}, 'js/src/forum/view.tsx')).toBe(
      await format(`export default function view() {
  ${todo}
  return (
    <div>
      {app.initializers.has('acpl/mobile-tab') && app.initializers.has('itnt-uitab') ? <span /> : null}
    </div>
  );
}
`)
    );
  });

  it("keeps its changes, and the misc step's other ones, when a later change rewrites the syntax tree", async () => {
    // As fof/impersonate's 1.x ImpersonateModal has it: the modal becomes a
    // FormModal by rewriting the syntax tree, after the text changes ran.
    const code = await upgrade(`import Modal from 'flarum/common/components/Modal';

export default class ImpersonateModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);

    this.reasonEnabled = app.initializers.has('flarum-tags');
    this.tag = this.currentTag;
  }

  content() {
    return <input className="FormControl" />;
  }
}
`);

    expect(code).toContain('extends FormModal');
    expect(code).toContain("this.reasonEnabled = 'flarum-tags' in flarum.extensions;");
    expect(code).toContain('this.tag = app.currentTag;');
  });

  it('changes nothing the second time', async () => {
    const once = await upgrade(`if (app.initializers.has('flarum-tags') || app.initializers.has('acme-other')) {
  console.log('tags');
}
`);

    expect(once).toContain("'flarum-tags' in flarum.extensions");
    expect(once.match(/@TODO/g)).toHaveLength(1);
    expect(await upgrade(once)).toBe(once);
  });
});
