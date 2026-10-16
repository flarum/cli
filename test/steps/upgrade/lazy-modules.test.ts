import UsageOfLazyModules from '../../../src/steps/upgrade/twopointoh/frontend/code-splitting/usage-of-lazy-modules';

async function upgrade(code: string, file = 'js/src/forum/index.js'): Promise<string> {
  const step = new UsageOfLazyModules({} as any, '/extension', 1, 1, false);
  const result = await step.applyReplacements(file, code, step.advancedContent(file, code));

  return result.updated as string;
}

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
