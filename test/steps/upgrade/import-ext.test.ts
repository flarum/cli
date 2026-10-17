import ImportExt from '../../../src/steps/upgrade/twopointoh/frontend/export-registry/import-ext';

/** Each file in turn through one step, as the upgrade does: the tsconfig comes last. */
async function upgrade(files: Record<string, string>): Promise<Record<string, string>> {
  const step = new ImportExt({} as any, '/extension', 1, 1, false);
  const upgraded: Record<string, string> = {};

  for (const [file, code] of Object.entries(files)) {
    // eslint-disable-next-line no-await-in-loop
    const result = await step.applyReplacements(file, code, step.advancedContent(file, code));

    upgraded[file] = result.updated as string;
  }

  return upgraded;
}

const tsconfig = (paths: Record<string, string[]>) =>
  JSON.stringify(
    { extends: 'flarum-tsconfig', compilerOptions: { paths: { 'flarum/*': ['../vendor/flarum/core/js/dist-typings/*'], ...paths } } },
    null,
    2
  );

describe('the import from extensions step, on code', () => {
  it("imports a bundled extension's modules from ext:, however the code imports them", async () => {
    const { 'js/src/forum/index.ts': code } = await upgrade({
      'js/src/forum/index.ts': `import Tag from 'flarum/tags/common/models/Tag';
import type TagListState from 'flarum/tags/common/states/TagListState';
import { slug } from "flarum/tags/common/utils/slug";
import * as tagUtils from 'flarum/tags/common/utils';
import Flag, { flags } from 'flarum/flags/forum/models/Flag';
import 'flarum/sticky/forum/addStickyBadge';
export { default as TagsPage } from 'flarum/tags/forum/components/TagsPage';
export * from 'flarum/tags/common/helpers';

const loadModal = () => import('flarum/tags/forum/components/TagDiscussionModal');
const Tags = require('flarum/tags/common/models/Tag');
type TagModel = typeof import('flarum/tags/common/models/Tag');

declare module 'flarum/tags/common/models/Tag' {
  export default interface Tag {
    language(): string;
  }
}
`,
    });

    // The step formats what it changes, so the quotes are Prettier's.
    expect(code).toBe(`import Tag from 'ext:flarum/tags/common/models/Tag';
import type TagListState from 'ext:flarum/tags/common/states/TagListState';
import { slug } from 'ext:flarum/tags/common/utils/slug';
import * as tagUtils from 'ext:flarum/tags/common/utils';
import Flag, { flags } from 'ext:flarum/flags/forum/models/Flag';
import 'ext:flarum/sticky/forum/addStickyBadge';
export { default as TagsPage } from 'ext:flarum/tags/forum/components/TagsPage';
export * from 'ext:flarum/tags/common/helpers';

const loadModal = () => import('ext:flarum/tags/forum/components/TagDiscussionModal');
const Tags = require('ext:flarum/tags/common/models/Tag');
type TagModel = typeof import('ext:flarum/tags/common/models/Tag');

declare module 'ext:flarum/tags/common/models/Tag' {
  export default interface Tag {
    language(): string;
  }
}
`);
  });

  it("leaves core's modules, and the 1.x shortcuts to them, as they are", async () => {
    const source = `import app from 'flarum/forum/app';
import Model from 'flarum/common/Model';
import Button from 'flarum/components/Button';
import icon from 'flarum/helpers/icon';
import ItemList from 'flarum/utils/ItemList';
import Discussion from 'flarum/models/Discussion';
import AdminPage from 'flarum/admin/components/AdminPage';
`;

    expect((await upgrade({ 'js/src/forum/index.ts': source }))['js/src/forum/index.ts']).toBe(source);
  });

  it('changes nothing the second time', async () => {
    const once = (await upgrade({ 'js/src/forum/index.ts': "import Tag from 'flarum/tags/common/models/Tag';\n" }))['js/src/forum/index.ts'];

    expect((await upgrade({ 'js/src/forum/index.ts': once }))['js/src/forum/index.ts']).toBe(once);
  });
});

describe('the import from extensions step, on the tsconfig', () => {
  const paths = async (code: string, config: string) =>
    JSON.parse((await upgrade({ 'js/src/forum/index.ts': code, 'js/tsconfig.json': config }))['js/tsconfig.json']).compilerOptions.paths;

  it("maps each extension's ext: modules to its typings, in place of the 1.x mapping", async () => {
    expect(
      await paths(
        "import type Tag from 'flarum/tags/common/models/Tag';\n",
        tsconfig({ 'flarum/tags/*': ['../vendor/flarum/tags/js/dist-typings/*'] })
      )
    ).toStrictEqual({
      'flarum/*': ['../vendor/flarum/core/js/dist-typings/*'],
      'ext:flarum/tags/*': ['../vendor/flarum/tags/js/dist-typings/*'],
    });
  });

  it('keeps where the 1.x mapping found the typings', async () => {
    expect(
      await paths("import Tag from 'flarum/tags/common/models/Tag';\n", tsconfig({ 'flarum/tags/*': ['../../packages/tags/js/dist-typings/*'] }))
    ).toStrictEqual({
      'flarum/*': ['../vendor/flarum/core/js/dist-typings/*'],
      'ext:flarum/tags/*': ['../../packages/tags/js/dist-typings/*'],
    });
  });

  it('maps an extension the 1.x tsconfig did not, from vendor', async () => {
    expect(await paths("import Flag from 'flarum/flags/forum/models/Flag';\n", tsconfig({}))).toStrictEqual({
      'flarum/*': ['../vendor/flarum/core/js/dist-typings/*'],
      'ext:flarum/flags/*': ['../vendor/flarum/flags/js/dist-typings/*'],
    });
  });

  it('keeps an ext: mapping the tsconfig already has', async () => {
    expect(
      await paths(
        "import Tag from 'flarum/tags/common/models/Tag';\n",
        tsconfig({ 'flarum/tags/*': ['../vendor/flarum/tags/js/dist-typings/*'], 'ext:flarum/tags/*': ['./typings/tags/*'] })
      )
    ).toStrictEqual({
      'flarum/*': ['../vendor/flarum/core/js/dist-typings/*'],
      'ext:flarum/tags/*': ['./typings/tags/*'],
    });
  });
});
