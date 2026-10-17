import UsageOfLazyModules from '../../../src/steps/upgrade/twopointoh/frontend/code-splitting/usage-of-lazy-modules';
import { formatCode } from '../../../src/utils/ast';

async function upgrade(code: string, file = 'js/src/forum/index.js'): Promise<string> {
  const step = new UsageOfLazyModules({} as any, '/extension', 1, 1, false);
  const result = await step.applyReplacements(file, code, step.advancedContent(file, code));

  return result.updated as string;
}

const format = (code: string) => formatCode(code);

const todo = (module: string, path: string) =>
  `// @TODO: ${module} is lazy loaded in 2.0, so this import is undefined until its chunk has loaded. Load it with \`await import('${path}')\` before using it. https://docs.flarum.org/2.x/extend/code-splitting`;

describe('the lazy modules step, on imports', () => {
  it('drops one the code only extends, which is then extended by its path', async () => {
    const code = await upgrade(`import { extend } from 'flarum/common/extend';
import SettingsPage from 'flarum/forum/components/SettingsPage';

extend(SettingsPage.prototype, 'settingsItems', function (items) {
  items.add('acme', 'Acme');
});
`);

    expect(code).not.toContain("import SettingsPage from 'flarum/forum/components/SettingsPage';");
    expect(code).toContain("extend('flarum/forum/components/SettingsPage', 'settingsItems'");
  });

  it('keeps one the code still uses, and says how to load it', async () => {
    const code = await upgrade(`import SignUpModal from 'flarum/forum/components/SignUpModal';

export const isSignUp = (modal) => modal instanceof SignUpModal;
`);

    expect(code).toContain(`${todo('SignUpModal', 'flarum/forum/components/SignUpModal')}
import SignUpModal from 'flarum/forum/components/SignUpModal';`);
  });

  it('keeps a type import, which the build erases', async () => {
    const code = await upgrade(
      `import type LogInModal from 'flarum/forum/components/LogInModal';

export function open(modal: LogInModal) {}
`,
      'js/src/forum/index.ts'
    );

    expect(code).toContain("import type LogInModal from 'flarum/forum/components/LogInModal';");
    expect(code).not.toContain('@TODO');
  });

  it('leaves the modules now in the main bundle alone', async () => {
    // As fof/geoip's MapModal has it.
    const source = `import LabelValue from 'flarum/common/components/LabelValue';
import LoadingPost from 'flarum/forum/components/LoadingPost';

export const view = () => [<LabelValue label="City" value="Bern" />, <LoadingPost />];
`;
    const code = await upgrade(source, 'js/src/forum/components/MapModal.js');

    expect(code).toContain("import LabelValue from 'flarum/common/components/LabelValue';");
    expect(code).toContain("import LoadingPost from 'flarum/forum/components/LoadingPost';");
    expect(code).not.toContain('@TODO');
  });

  it('asks only once when run again', async () => {
    const once = await upgrade(`import SignUpModal from 'flarum/forum/components/SignUpModal';

export const isSignUp = (modal) => modal instanceof SignUpModal;
`);

    expect((await upgrade(once)).split('@TODO').length).toBe(2);
  });
});

describe('the lazy modules step, on methods given to a prototype', () => {
  // In 2.0 the module is undefined until its chunk has loaded, so the method is
  // given with override() by the module's path: it then replaces the method as
  // the assignment did, with the same arguments, return value and this.

  it("gives one to a lazy module's prototype with override, by the module's path", async () => {
    // As fof/drafts' 1.x forum has it.
    expect(
      await upgrade(`import ItemList from 'flarum/common/utils/ItemList';
import SettingsPage from 'flarum/forum/components/SettingsPage';

SettingsPage.prototype.draftsItems = function () {
  const items = new ItemList();

  return items;
};
`)
    ).toBe(
      await format(`import { override } from 'flarum/common/extend';
import ItemList from 'flarum/common/utils/ItemList';

override('flarum/forum/components/SettingsPage', 'draftsItems', function (original) {
  const items = new ItemList();

  return items;
});
`)
    );
  });

  it("gives one to a composer's prototype the same way, when the file does not load that composer", async () => {
    expect(
      await upgrade(`import { extend } from 'flarum/common/extend';
import DiscussionComposer from 'flarum/forum/components/DiscussionComposer';

export default function () {
  DiscussionComposer.prototype.chooseLanguage = function (hide, callback) {
    this.hide = hide;

    if (callback) callback();
  };
}
`)
    ).toBe(
      await format(`import { extend, override } from 'flarum/common/extend';

export default function () {
  override('flarum/forum/components/DiscussionComposer', 'chooseLanguage', function (original, hide, callback) {
    this.hide = hide;

    if (callback) callback();
  });
}
`)
    );
  });

  it('keeps a this parameter first, where TypeScript needs it', async () => {
    // As fof/discussion-language's 1.x composer code has it.
    const code = await upgrade(
      `import DiscussionComposer from 'flarum/forum/components/DiscussionComposer';

DiscussionComposer.prototype.chooseLanguage = function (this: DiscussionComposer, hide: boolean, callback: (() => void) | null) {
  if (callback) callback();
};
`,
      'js/src/forum/addLanguageComposer.tsx'
    );

    expect(code).toMatch(
      /override\(\s*'flarum\/forum\/components\/DiscussionComposer',\s*'chooseLanguage',\s*function \(this: DiscussionComposer, original, hide: boolean, callback: \(\(\) => void\) \| null\) {/
    );
  });

  it('gives one that is an arrow function, or named by a string, the same way', async () => {
    expect(
      await upgrade(`import { override } from 'flarum/common/extend';
import SettingsPage from 'flarum/forum/components/SettingsPage';

SettingsPage.prototype.label = (name) => name.toUpperCase();
SettingsPage.prototype['tagline'] = function () {
  return 'Settings';
};
`)
    ).toBe(
      await format(`import { override } from 'flarum/common/extend';

override('flarum/forum/components/SettingsPage', 'label', (original, name) => name.toUpperCase());
override('flarum/forum/components/SettingsPage', 'tagline', function (original) {
  return 'Settings';
});
`)
    );
  });

  it('names the original method so it hides nothing the method uses', async () => {
    const code = await upgrade(`import SettingsPage from 'flarum/forum/components/SettingsPage';

const original = 'Settings';

SettingsPage.prototype.tagline = function () {
  return original;
};
`);

    expect(code).toContain("override('flarum/forum/components/SettingsPage', 'tagline', function (_original) {\n  return original;\n});");
  });

  it('keeps the arguments a method reads with arguments where they were', async () => {
    const code = await upgrade(`import SettingsPage from 'flarum/forum/components/SettingsPage';

SettingsPage.prototype.log = function () {
  console.log(arguments);
};
`);

    expect(code).toContain(`override('flarum/forum/components/SettingsPage', 'log', function (original, ...args) {
  return function () {
    console.log(arguments);
  }.apply(this, args);
});`);
  });

  it('calls override by the name the file imports it with', async () => {
    expect(
      await upgrade(`import { override as replace } from 'flarum/common/extend';
import SettingsPage from 'flarum/forum/components/SettingsPage';

SettingsPage.prototype.tagline = function () {
  return 'Settings';
};
`)
    ).toBe(
      await format(`import { override as replace } from 'flarum/common/extend';

replace('flarum/forum/components/SettingsPage', 'tagline', function (original) {
  return 'Settings';
});
`)
    );
  });

  it('leaves one whose name it cannot tell, for the author', async () => {
    const code = await upgrade(`import SettingsPage from 'flarum/forum/components/SettingsPage';

const method = 'tagline';

SettingsPage.prototype[method] = function () {
  return 'Settings';
};
`);

    expect(code).toContain('SettingsPage.prototype[method] = function () {');
    expect(code).not.toContain('override(');
  });

  it("moves a composer's into the then() of the file's own load of it", async () => {
    // Where the file loads the composer itself, it has the module there.
    expect(
      await upgrade(`import app from 'flarum/forum/app';
import DiscussionComposer from 'flarum/forum/components/DiscussionComposer';

DiscussionComposer.prototype.chooseLanguage = function () {
  return 'language';
};

export function compose() {
  app.composer.load(DiscussionComposer, { user: app.session.user });
  app.composer.show();
}
`)
    ).toBe(
      await format(`import app from 'flarum/forum/app';
${todo('DiscussionComposer', 'flarum/forum/components/DiscussionComposer')}
import DiscussionComposer from 'flarum/forum/components/DiscussionComposer';

export function compose() {
  app.composer
    .load(() => import('flarum/forum/components/DiscussionComposer'), { user: app.session.user })
    .then((DiscussionComposer) => {
      // @TODO: Move all direct access to the module object here. Including subsequent calls to app.composer.show(), checkout https://docs.flarum.org/2.x/extend/code-splitting#async-composers
      DiscussionComposer.prototype.chooseLanguage = function () {
        return 'language';
      };

      app.composer.show();
    });
}
`)
    );
  });

  it('changes nothing the second time', async () => {
    const once = await upgrade(`import SettingsPage from 'flarum/forum/components/SettingsPage';

SettingsPage.prototype.tagline = function () {
  return 'Settings';
};
`);

    expect(await upgrade(once)).toBe(once);
  });
});
