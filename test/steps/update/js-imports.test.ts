
import { create } from 'mem-fs';
import { create as createMemFsEditor } from 'mem-fs-editor';
import { stubParamProviderFactory, stubPathProviderFactory, stubPhpProviderFactory } from '../../stubs';
import { UpdateJSImports } from '../../../src/steps/update/js-imports';
import { Step } from '../../../src/steps/step-manager';
import { resolve } from 'path';

const files = [
  // admin
  'admin/AdminPage.js',
  'admin/components/ExtensionPage.ts',
  'admin/components/some/sub/path/PermissionGrid.tsx',
  // common
  'common/utils/Badge.js',
  'common/components/Button.ts',
  'common/some_name/Switch.tsx',
  // forum
  'forum/components/UserPage.js',
  'forum/components/PostStream.ts',
  'forum/components/DiscussionListItem.tsx',
];

const fileToRewrite = `import AdminPage from 'flarum/AdminPage';
import { AdminPage, SomethingElse } from 'flarum/admin/AdminPage';

import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import { Something as SOmethingElse } from 'flarum/components/ExtensionPage';

import A from 'flarum/admin/components/some/sub/path/PermissionGrid';
import A from 'flarum/components/some/sub/path/PermissionGrid';


import X from 'flarum/utils/Badge';
import X from 'flarum/common/components/Button';
import X from 'flarum/some_name/Switch';


import X from 'flarum/components/UserPage';
import X from 'flarum/components/PostStream';
import X from 'flarum/components/DiscussionListItem';`;

const expectedOutput = `import AdminPage from 'flarum/admin/AdminPage';
import { AdminPage, SomethingElse } from 'flarum/admin/AdminPage';

import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import { Something as SOmethingElse } from 'flarum/admin/components/ExtensionPage';

import A from 'flarum/admin/components/some/sub/path/PermissionGrid';
import A from 'flarum/admin/components/some/sub/path/PermissionGrid';


import X from 'flarum/common/utils/Badge';
import X from 'flarum/common/components/Button';
import X from 'flarum/common/some_name/Switch';


import X from 'flarum/forum/components/UserPage';
import X from 'flarum/forum/components/PostStream';
import X from 'flarum/forum/components/DiscussionListItem';`;

describe('Test JS import rewrite', function () {
  test('Rewrites imports properly', async function () {
    const fs = create();

    // JS import step will rewrite based on existing vendor files, so we need to make those.
    files.forEach(path => {
      createMemFsEditor(fs).write(resolve('/ext/vendor/flarum/core/js/src', path), 'Something');
    });

    createMemFsEditor(fs).write(resolve('/ext/js/src/forum/something.js'), fileToRewrite);

    const step: Step = new UpdateJSImports();
    const pathProvider = stubPathProviderFactory({ boilerplate: resolve(__dirname, '../boilerplate') });
    const paramProvider = stubParamProviderFactory({});
    const phpProvider = stubPhpProviderFactory();

    const newFs = await step.run(fs, pathProvider, paramProvider, phpProvider);

    expect(createMemFsEditor(newFs).read(resolve('/ext/js/src/forum/something.js'))).toStrictEqual(expectedOutput);
  });
});
