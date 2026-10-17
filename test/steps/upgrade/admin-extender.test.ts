import fs from 'fs';
import os from 'os';
import path from 'path';
import AdminExtender from '../../../src/steps/upgrade/twopointoh/frontend/admin-extender';
import MiscFrontendChanges from '../../../src/steps/upgrade/twopointoh/frontend/misc';
import { formatCode } from '../../../src/utils/ast';

/**
 * Flarum 2.0 registers an extension's settings, permissions and page with the
 * Admin extender, in admin/extend, rather than through the registry in an
 * initializer. The upgrade moves the registrations it can move without
 * changing what they do, and leaves a @TODO on the rest.
 */

type Files = Record<string, string>;

function extension(files: Files, name: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-extender-'));

  for (const [file, code] of Object.entries({ 'composer.json': JSON.stringify({ name }), ...files })) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), code);
  }

  return root;
}

/** The index as the step leaves it, and the files it writes. */
async function upgrade(files: Files, index = 'js/src/admin/index.ts', name = 'acme/flarum-interstellar'): Promise<{ index: string; written: Files }> {
  const step = new AdminExtender({} as any, extension(files, name), 1, 1, false);
  const code = files[index];
  const result = await step.applyReplacements(index, code, step.advancedContent(index, code));

  return {
    index: result.updated as string,
    written: Object.fromEntries((result.newFiles ?? []).map((file) => [file.path, file.code])),
  };
}

const format = (code: string) => formatCode(code);

describe('registering admin settings, permissions and pages with Extend.Admin', () => {
  describe('moves', () => {
    it('a setting into a new admin/extend, which the index exports', async () => {
      const { index, written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerSetting({
    setting: 'acme-interstellar.coordinates',
    label: app.translator.trans('acme-interstellar.admin.coordinates_label'),
    type: 'boolean',
  });
});
`,
      });

      // The initializer has nothing left to do, so it goes, and the app only it
      // used. 2.0 checks whether an extension is enabled in flarum.extensions.
      expect(index).toBe(
        await format(`export { default as extend } from './extend';
`)
      );

      expect(written).toEqual({
        'js/src/admin/extend.ts': await format(`import Extend from 'flarum/common/extenders';
import app from 'flarum/admin/app';

export default [
  new Extend.Admin().setting(() => ({
    setting: 'acme-interstellar.coordinates',
    label: app.translator.trans('acme-interstellar.admin.coordinates_label'),
    type: 'boolean',
  })),
];
`),
      });
    });

    it('from an index that exports from an ambient module', async () => {
      // Valid TypeScript, which Babel reports as an undeclared export unless it
      // is told not to check.
      const { index, written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';

declare module 'acme-shims' {
  const shim: string;
  export { shim };
}

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerSetting({ setting: 'acme-interstellar.fuel', type: 'text' });
});
`,
      });

      expect(index).toBe(
        await format(`export { default as extend } from './extend';

declare module 'acme-shims' {
  const shim: string;
  export { shim };
}
`)
      );

      expect(written).toEqual({
        'js/src/admin/extend.ts': await format(`import Extend from 'flarum/common/extenders';

export default [new Extend.Admin().setting(() => ({ setting: 'acme-interstellar.fuel', type: 'text' }))];
`),
      });
    });

    it('into an admin/extend that exports from an ambient module', async () => {
      const { written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';

export { default as extend } from './extend';

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerSetting({ setting: 'acme-interstellar.fuel', type: 'text' });
});
`,
        'js/src/admin/extend.ts': `import Extend from 'flarum/common/extenders';

declare module 'acme-shims' {
  const shim: string;
  export { shim };
}

export default [];
`,
      });

      expect(written).toEqual({
        'js/src/admin/extend.ts': await format(`import Extend from 'flarum/common/extenders';

declare module 'acme-shims' {
  const shim: string;
  export { shim };
}

export default [new Extend.Admin().setting(() => ({ setting: 'acme-interstellar.fuel', type: 'text' }))];
`),
      });
    });

    it('leaving an initializer that still has other work in place', async () => {
      const { index } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerSetting({ setting: 'acme-interstellar.fuel', type: 'text' });

  console.log('ready');
});
`,
      });

      expect(index).toBe(
        await format(`import app from 'flarum/admin/app';

export { default as extend } from './extend';

app.initializers.add('acme-interstellar', () => {
  console.log('ready');
});
`)
      );
    });

    it('leaving an initializer with a comment of its own in place', async () => {
      const { index } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerSetting({ setting: 'acme-interstellar.fuel', type: 'text' });
  // More settings once the launch pad is built.
});
`,
      });

      expect(index).toContain("app.initializers.add('acme-interstellar'");
      expect(index).toContain('// More settings once the launch pad is built.');
    });

    it('removing an initializer with the comments above it', async () => {
      const { index } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';

// Register the settings.
app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerSetting({ setting: 'acme-interstellar.fuel', type: 'text' });
});
`,
      });

      expect(index).toBe(
        await format(`export { default as extend } from './extend';
`)
      );
    });

    it('each registration as its Admin extender method, with its priority and type', async () => {
      const { index, written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';
import { extend } from 'flarum/common/extend';
import BasicsPage from 'flarum/admin/components/BasicsPage';
import SettingsPage from './components/SettingsPage';

app.initializers.add('acme-interstellar', () => {
  app.extensionData
    .for('acme-interstellar')
    .registerPage(SettingsPage)
    .registerSetting(
      {
        setting: 'acme-interstellar.fuel',
        type: 'select',
        options: { LOH: 'Liquid', RDX: 'Solid' },
      },
      30
    )
    .registerSetting(function () {
      return <p>{this.setting('acme-interstellar.fuel')()}</p>;
    }, 10)
    .registerSetting(() => <hr />)
    .registerPermission(
      {
        icon: 'fas fa-rocket',
        label: app.translator.trans('acme-interstellar.admin.permissions.launch_label'),
        permission: 'acme-interstellar.launch',
      },
      'moderate',
      90
    )
    .registerPermission(
      {
        icon: 'fas fa-eye',
        label: app.translator.trans('acme-interstellar.admin.permissions.view_label'),
        permission: 'acme-interstellar.view',
        allowGuest: true,
      },
      'view'
    );

  extend(BasicsPage.prototype, 'homePageItems', (items) => {
    items.add('interstellar', { path: '/interstellar', label: 'Interstellar' });
  });
});
`,
      });

      expect(index).toBe(
        await format(`import app from 'flarum/admin/app';
import { extend } from 'flarum/common/extend';
import BasicsPage from 'flarum/admin/components/BasicsPage';

export { default as extend } from './extend';

app.initializers.add('acme-interstellar', () => {
  extend(BasicsPage.prototype, 'homePageItems', (items) => {
    items.add('interstellar', { path: '/interstellar', label: 'Interstellar' });
  });
});
`)
      );

      expect(written['js/src/admin/extend.ts']).toBe(
        await format(`import Extend from 'flarum/common/extenders';
import app from 'flarum/admin/app';
import SettingsPage from './components/SettingsPage';

export default [
  new Extend.Admin()
    .page(SettingsPage)
    .setting(
      () => ({
        setting: 'acme-interstellar.fuel',
        type: 'select',
        options: { LOH: 'Liquid', RDX: 'Solid' },
      }),
      30
    )
    .customSetting(function () {
      return <p>{this.setting('acme-interstellar.fuel')()}</p>;
    }, 10)
    .customSetting(() => <hr />)
    .permission(
      () => ({
        icon: 'fas fa-rocket',
        label: app.translator.trans('acme-interstellar.admin.permissions.launch_label'),
        permission: 'acme-interstellar.launch',
      }),
      'moderate',
      90
    )
    .permission(
      () => ({
        icon: 'fas fa-eye',
        label: app.translator.trans('acme-interstellar.admin.permissions.view_label'),
        permission: 'acme-interstellar.view',
        allowGuest: true,
      }),
      'view'
    ),
];
`)
      );
    });

    it("an initializer's chains into one extender, in their order, with their comments", async () => {
      // As fof/blog's 1.x admin has it. Its PermissionGrid extension reads the
      // registry as the grid renders, by when the extender has run.
      const { index, written } = await upgrade(
        {
          'js/src/admin/index.ts': `import app from 'flarum/admin/app';
import { extend } from 'flarum/common/extend';
import PermissionGrid from 'flarum/admin/components/PermissionGrid';
import BlogSettings from './pages/BlogSettings';
import { BLOG_PERMISSION_CATEGORY } from './permissions';

app.initializers.add('fof-blog', () => {
  // Register extension settings page
  app.extensionData.for('fof-blog').registerPage(BlogSettings);

  app.extensionData
    .for('fof-blog')
    .registerPermission(
      {
        icon: 'fas fa-pencil-alt',
        label: app.translator.trans('fof-blog.admin.permissions.write_articles'),
        permission: 'blog.writeArticles',
      },
      BLOG_PERMISSION_CATEGORY,
      90
    )
    // Approving is a moderator's job
    .registerPermission(
      {
        icon: 'far fa-thumbs-up',
        label: app.translator.trans('fof-blog.admin.permissions.approve_posts'),
        permission: 'blog.canApprovePosts',
      },
      BLOG_PERMISSION_CATEGORY,
      90
    );

  // Add addPermissions
  extend(PermissionGrid.prototype, 'permissionItems', function (items) {
    items.add(
      'blog',
      {
        label: app.translator.trans('fof-blog.admin.blog'),
        children: app.extensionData.getAllExtensionPermissions(BLOG_PERMISSION_CATEGORY).toArray(),
      },
      80
    );
  });
});
`,
        },
        'js/src/admin/index.ts',
        'fof/blog'
      );

      expect(index).toBe(
        await format(`import app from 'flarum/admin/app';
import { extend } from 'flarum/common/extend';
import PermissionGrid from 'flarum/admin/components/PermissionGrid';
import { BLOG_PERMISSION_CATEGORY } from './permissions';

export { default as extend } from './extend';

app.initializers.add('fof-blog', () => {
  // Add addPermissions
  extend(PermissionGrid.prototype, 'permissionItems', function (items) {
    items.add(
      'blog',
      {
        label: app.translator.trans('fof-blog.admin.blog'),
        children: app.extensionData.getAllExtensionPermissions(BLOG_PERMISSION_CATEGORY).toArray(),
      },
      80
    );
  });
});
`)
      );

      expect(written['js/src/admin/extend.ts']).toBe(
        await format(`import Extend from 'flarum/common/extenders';
import app from 'flarum/admin/app';
import BlogSettings from './pages/BlogSettings';
import { BLOG_PERMISSION_CATEGORY } from './permissions';

export default [
  new Extend.Admin()
    // Register extension settings page
    .page(BlogSettings)
    .permission(
      () => ({
        icon: 'fas fa-pencil-alt',
        label: app.translator.trans('fof-blog.admin.permissions.write_articles'),
        permission: 'blog.writeArticles',
      }),
      BLOG_PERMISSION_CATEGORY,
      90
    )
    // Approving is a moderator's job
    .permission(
      () => ({
        icon: 'far fa-thumbs-up',
        label: app.translator.trans('fof-blog.admin.permissions.approve_posts'),
        permission: 'blog.canApprovePosts',
      }),
      BLOG_PERMISSION_CATEGORY,
      90
    ),
];
`)
      );
    });

    it('naming the extension only when for() names another one', async () => {
      const { written } = await upgrade(
        {
          'js/src/admin/index.js': `app.initializers.add('acme-interstellar', () => {
  app.registry.for('acme-interstellar').registerPermission({ icon: 'fas fa-rocket', label: 'Launch', permission: 'launch' }, 'start');
  app.registry.for('flarum-tags').registerSetting({ setting: 'acme-interstellar.tag_rockets', type: 'boolean', label: 'Rockets' });
});
`,
        },
        'js/src/admin/index.js',
        // Core takes flarum-ext- and flarum- off the package name for the ID.
        'acme/flarum-ext-interstellar'
      );

      expect(written['js/src/admin/extend.js']).toBe(
        await format(`import Extend from 'flarum/common/extenders';

export default [
  new Extend.Admin().permission(() => ({ icon: 'fas fa-rocket', label: 'Launch', permission: 'launch' }), 'start'),

  new Extend.Admin('flarum-tags').setting(() => ({ setting: 'acme-interstellar.tag_rockets', type: 'boolean', label: 'Rockets' })),
];
`)
      );
    });

    it('using the app the initializer is given as the app extend imports', async () => {
      // As flarum/tags and fof/gamification's 1.x admins have it, with no import.
      const { index, written } = await upgrade(
        {
          'js/src/admin/index.js': `import SettingsPage from './components/SettingsPage';

app.initializers.add('acme-interstellar', (app) => {
  app.extensionData.for('acme-interstellar').registerPage(SettingsPage);
});
`,
        },
        'js/src/admin/index.js'
      );

      expect(index).toBe(
        await format(`export { default as extend } from './extend';
`)
      );

      expect(written['js/src/admin/extend.js']).toBe(
        await format(`import Extend from 'flarum/common/extenders';
import SettingsPage from './components/SettingsPage';

export default [new Extend.Admin().page(SettingsPage)];
`)
      );
    });

    it('with the constants and type imports the registrations use', async () => {
      // As fof/follow-tags' 1.x admin has it.
      const { index, written } = await upgrade(
        {
          'js/src/admin/index.tsx': `import app from 'flarum/admin/app';
import type ExtensionPage from 'flarum/admin/components/ExtensionPage';
import { extend } from 'flarum/common/extend';
import BasicsPage from 'flarum/admin/components/BasicsPage';

const translationPrefix = 'fof-follow-tags.admin.settings.';
const settingsPrefix = \`fof-follow-tags.\`;
const strategy = settingsPrefix + 'prompt_tag_strategy';

app.initializers.add('fof/follow-tags', () => {
  app.extensionData
    .for('fof-follow-tags')
    .registerSetting({
      setting: strategy,
      type: 'select',
      label: app.translator.trans(translationPrefix + 'prompt_tag_strategy_label'),
    })
    .registerSetting(function (this: ExtensionPage) {
      return <label>{app.translator.trans(translationPrefix + 'prompt_tag_ids_label')}</label>;
    });

  extend(BasicsPage.prototype, 'homePageItems', function (items) {
    items.add('following', { path: '/following', label: app.translator.trans(translationPrefix + 'following_label') });
  });
});
`,
        },
        'js/src/admin/index.tsx',
        'fof/follow-tags'
      );

      expect(index).toBe(
        await format(`import app from 'flarum/admin/app';
import { extend } from 'flarum/common/extend';
import BasicsPage from 'flarum/admin/components/BasicsPage';

export { default as extend } from './extend';

const translationPrefix = 'fof-follow-tags.admin.settings.';

app.initializers.add('fof/follow-tags', () => {
  extend(BasicsPage.prototype, 'homePageItems', function (items) {
    items.add('following', { path: '/following', label: app.translator.trans(translationPrefix + 'following_label') });
  });
});
`)
      );

      expect(written['js/src/admin/extend.tsx']).toBe(
        await format(`import Extend from 'flarum/common/extenders';
import app from 'flarum/admin/app';
import type ExtensionPage from 'flarum/admin/components/ExtensionPage';

const translationPrefix = 'fof-follow-tags.admin.settings.';
const settingsPrefix = \`fof-follow-tags.\`;
const strategy = settingsPrefix + 'prompt_tag_strategy';

export default [
  new Extend.Admin()
    .setting(() => ({
      setting: strategy,
      type: 'select',
      label: app.translator.trans(translationPrefix + 'prompt_tag_strategy_label'),
    }))
    .customSetting(function (this: ExtensionPage) {
      return <label>{app.translator.trans(translationPrefix + 'prompt_tag_ids_label')}</label>;
    }),
];
`)
      );
    });

    it('into the admin/extend the extension already has', async () => {
      // As fof/badges' 1.x admin has it.
      const { index, written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';
import SettingsPage from './components/SettingsPage';

export { default as extend } from './extend';

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerPage(SettingsPage);
});
`,
        'js/src/admin/extend.ts': `import Extend from 'flarum/common/extenders';
import commonExtend from '../common/extend';

export default [...commonExtend];
`,
      });

      expect(index).toBe(
        await format(`export { default as extend } from './extend';
`)
      );

      expect(written).toEqual({
        'js/src/admin/extend.ts': await format(`import Extend from 'flarum/common/extenders';
import commonExtend from '../common/extend';
import SettingsPage from './components/SettingsPage';

export default [...commonExtend, new Extend.Admin().page(SettingsPage)];
`),
      });
    });

    it('into the admin/extend the extension already has, with the constants it uses', async () => {
      const { written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';

export { default as extend } from './extend';

const prefix = 'acme-interstellar.';

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerSetting({ setting: prefix + 'coordinates', type: 'boolean', label: 'Coordinates' });
});
`,
        'js/src/admin/extend.ts': `import Extend from 'flarum/common/extenders';

export default [
  // Add your admin extenders here
];
`,
      });

      expect(written['js/src/admin/extend.ts']).toBe(
        await format(`import Extend from 'flarum/common/extenders';

const prefix = 'acme-interstellar.';

export default [
  // Add your admin extenders here
  new Extend.Admin().setting(() => ({ setting: prefix + 'coordinates', type: 'boolean', label: 'Coordinates' })),
];
`)
      );
    });

    it('with the comments inside its calls', async () => {
      const { written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';

app.initializers.add('acme-interstellar', () => {
  app.extensionData
    .for('acme-interstellar')
    .registerSetting(/* Where to fly */ { setting: 'acme-interstellar.coordinates', type: 'text', label: 'Coordinates' }) /* the only one */;
});
`,
      });

      expect(written['js/src/admin/extend.ts']).toContain('/* Where to fly */');
      expect(written['js/src/admin/extend.ts']).toContain('/* the only one */');
    });

    it('into the admin/extend the extension already has, importing what it lacks of a module it imports from', async () => {
      const { written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';
import { fuelOptions, launchIcon } from './options';

export { default as extend } from './extend';

app.initializers.add('acme-interstellar', () => {
  app.extensionData
    .for('acme-interstellar')
    .registerSetting({ setting: 'acme-interstellar.fuel', type: 'select', options: fuelOptions(), label: 'Fuel' })
    .registerPermission({ icon: launchIcon, label: 'Launch', permission: 'launch' }, 'start');
});
`,
        'js/src/admin/extend.ts': `import Extend from 'flarum/common/extenders';
import { fuelOptions } from './options';

export default [new Extend.Routes().add('fuel', '/fuel', fuelOptions)];
`,
      });

      expect(written['js/src/admin/extend.ts']).toBe(
        await format(`import Extend from 'flarum/common/extenders';
import { fuelOptions } from './options';
import { launchIcon } from './options';

export default [
  new Extend.Routes().add('fuel', '/fuel', fuelOptions),

  new Extend.Admin()
    .setting(() => ({ setting: 'acme-interstellar.fuel', type: 'select', options: fuelOptions(), label: 'Fuel' }))
    .permission(() => ({ icon: launchIcon, label: 'Launch', permission: 'launch' }), 'start'),
];
`)
      );
    });

    it('into a new admin/extend that keeps the common extenders the index exported', async () => {
      // As flarum/tags' 1.x admin has it.
      const { index, written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';
import TagsPage from './components/TagsPage';

export { default as extend } from '../common/extend';

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerPage(TagsPage);
});
`,
        'js/src/common/extend.ts': `export default [];
`,
      });

      expect(index).toBe(
        await format(`export { default as extend } from './extend';
`)
      );

      expect(written['js/src/admin/extend.ts']).toBe(
        await format(`import Extend from 'flarum/common/extenders';
import commonExtend from '../common/extend';
import TagsPage from './components/TagsPage';

export default [...commonExtend, new Extend.Admin().page(TagsPage)];
`)
      );
    });
  });

  describe('leaves', () => {
    const todo = (reason: string) =>
      `// @TODO: register this with Extend.Admin in admin/extend instead (https://docs.flarum.org/2.x/extend/admin). The upgrade left it here because ${reason}.`;

    it('registrations that use what the initializer declares, with a @TODO on each', async () => {
      // As afrux/news-widget's 1.x admin has it.
      const code = `import app from 'flarum/admin/app';

app.initializers.add('acme-interstellar', () => {
  const settingKey = 'acme-interstellar.coordinates';

  app.extensionData.for('acme-interstellar').registerSetting({ setting: settingKey, type: 'boolean', label: 'Coordinates' });
  app.extensionData.for('acme-interstellar').registerPermission({ icon: 'fas fa-rocket', label: 'Launch', permission: 'launch' }, 'start');
});
`;

      const { index, written } = await upgrade({ 'js/src/admin/index.ts': code });

      // Moving only the permission would still put it after registrations
      // that stay, so neither moves.
      expect(index).toBe(
        await format(`import app from 'flarum/admin/app';

app.initializers.add('acme-interstellar', () => {
  const settingKey = 'acme-interstellar.coordinates';

  ${todo('it uses settingKey, which this initializer declares')}
  app.extensionData.for('acme-interstellar').registerSetting({ setting: settingKey, type: 'boolean', label: 'Coordinates' });
  ${todo('another registration in this file cannot move, and moving only some would change their order')}
  app.extensionData.for('acme-interstellar').registerPermission({ icon: 'fas fa-rocket', label: 'Launch', permission: 'launch' }, 'start');
});
`)
      );
      expect(written).toEqual({});
    });

    it('registrations that use a type the index declares', async () => {
      // As clarkwinkelmann/flarum-ext-anonymous-posting's 1.x admin has it.
      const { index, written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';

interface Avatar {
  url: string;
}

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerSetting(function () {
    const avatars: Avatar[] = JSON.parse(this.setting('acme-interstellar.avatars')() || '[]');

    return m('ul', avatars.map((avatar) => m('li', avatar.url)));
  });
});
`,
      });

      expect(index).toContain(todo('it uses Avatar, which this file declares'));
      expect(written).toEqual({});
    });

    it('registrations when admin/extend imports only the type of something they use', async () => {
      const { index, written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';
import SettingsPage from './components/SettingsPage';

export { default as extend } from './extend';

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerPage(SettingsPage);
});
`,
        'js/src/admin/extend.ts': `import Extend from 'flarum/common/extenders';
import type SettingsPage from './components/SettingsPage';

export default [] as Array<SettingsPage>;
`,
      });

      expect(index).toContain(todo('js/src/admin/extend.ts does not export an array the upgrade can add to'));
      expect(written).toEqual({});

      const typeOnly = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';
import SettingsPage from './components/SettingsPage';

export { default as extend } from './extend';

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerPage(SettingsPage);
});
`,
        'js/src/admin/extend.ts': `import Extend from 'flarum/common/extenders';
import type SettingsPage from './components/SettingsPage';

export default [];
`,
      });

      expect(typeOnly.index).toContain(todo('js/src/admin/extend.ts already uses the name SettingsPage'));
      expect(typeOnly.written).toEqual({});
    });

    it('registrations that use something with a name the extend file needs', async () => {
      const { index, written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';

const Extend = 'acme-interstellar.extend';

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerSetting({ setting: Extend, type: 'boolean', label: 'Extend' });
});
`,
      });

      expect(index).toContain(todo('admin/extend would need two different things named Extend'));
      expect(written).toEqual({});
    });

    it('everything when other code registers as the initializer runs', async () => {
      // As fof/impersonate's 1.x admin has it.
      const { index, written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';

app.initializers.add('fof-impersonate', () => {
  app.extensionData.for('fof-impersonate').registerPermission({ icon: 'fas fa-id-card', label: 'Login', permission: 'fof-impersonate.login' }, 'moderate');

  if (app.initializers.has('fof-moderator-notes')) {
    app.extensionData.for('fof-impersonate').registerSetting({ setting: 'fof-impersonate.require_reason', type: 'boolean', label: 'Reason' });
  }
});
`,
      });

      expect(index).toBe(
        await format(`import app from 'flarum/admin/app';

app.initializers.add('fof-impersonate', () => {
  ${todo('other code in this file uses the registry as it runs')}
  app.extensionData.for('fof-impersonate').registerPermission({ icon: 'fas fa-id-card', label: 'Login', permission: 'fof-impersonate.login' }, 'moderate');

  if (app.initializers.has('fof-moderator-notes')) {
    app.extensionData.for('fof-impersonate').registerSetting({ setting: 'fof-impersonate.require_reason', type: 'boolean', label: 'Reason' });
  }
});
`)
      );
      expect(written).toEqual({});
    });

    it('everything when another admin file uses the registry', async () => {
      // As flarum/tags' 1.x addTagPermission has it.
      const { index, written } = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';
import addTagPermission from './addTagPermission';

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerPermission({ icon: 'fas fa-rocket', label: 'Launch', permission: 'launch' }, 'start');

  addTagPermission();
});
`,
        'js/src/admin/addTagPermission.ts': `import app from 'flarum/admin/app';

export default function () {
  app.extensionData.for('acme-interstellar').registerPermission({ icon: 'fas fa-tag', label: 'Tag', permission: 'tag' }, 'moderate');
}
`,
      });

      expect(index).toBe(
        await format(`import app from 'flarum/admin/app';
import addTagPermission from './addTagPermission';

app.initializers.add('acme-interstellar', () => {
  ${todo('js/src/admin/addTagPermission.ts uses the registry too')}
  app.extensionData.for('acme-interstellar').registerPermission({ icon: 'fas fa-rocket', label: 'Launch', permission: 'launch' }, 'start');

  addTagPermission();
});
`)
      );
      expect(written).toEqual({});
    });

    it('an extension whose index has no registrations', async () => {
      const code = `import app from 'flarum/admin/app';

app.initializers.add('acme-interstellar', () => {
  console.log('Hello, admin!');
});
`;

      const { index, written } = await upgrade({ 'js/src/admin/index.ts': code });

      expect(index).toBe(code);
      expect(written).toEqual({});
    });

    it('what it has already upgraded', async () => {
      const moved = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';

app.initializers.add('acme-interstellar', () => {
  app.extensionData.for('acme-interstellar').registerPermission({ icon: 'fas fa-rocket', label: 'Launch', permission: 'launch' }, 'start');
});
`,
      });

      expect(Object.keys(moved.written)).toEqual(['js/src/admin/extend.ts']);

      const again = await upgrade({ 'js/src/admin/index.ts': moved.index, ...moved.written });

      expect(again.index).toBe(moved.index);
      expect(again.written).toEqual({});

      const left = await upgrade({
        'js/src/admin/index.ts': `import app from 'flarum/admin/app';

app.initializers.add('acme-interstellar', () => {
  const key = 'acme-interstellar.coordinates';

  app.extensionData.for('acme-interstellar').registerSetting({ setting: key, type: 'boolean', label: 'Coordinates' });
});
`,
      });

      expect(left.index.match(/@TODO/g)).toHaveLength(1);
      expect((await upgrade({ 'js/src/admin/index.ts': left.index })).index).toBe(left.index);
    });
  });
});

describe('app.extensionData, which Flarum 2.0 renamed app.registry', () => {
  it('is renamed everywhere in a file, not only where it first appears', async () => {
    // fof/blog's 1.x admin uses it four times.
    const step = new MiscFrontendChanges({} as any, '/extension', 1, 1, false);
    const file = 'js/src/admin/index.js';
    const code = `app.extensionData.for('fof-blog').registerPage(BlogSettings);

app.extensionData.for('fof-blog').registerPermission({ permission: 'blog.writeArticles' }, 'start');

const all = app.extensionData.getAllExtensionPermissions('start');
`;

    const result = await step.applyReplacements(file, code, step.advancedContent(file, code));

    expect(result.updated).not.toContain('extensionData');
    expect((result.updated as string).match(/app\.registry/g)).toHaveLength(3);
  });

  it('calls getAllPermissions(), which getAllExtensionPermissions() was renamed', async () => {
    // As fof/blog's and fof/seo's 1.x PermissionGrid extensions have it.
    const step = new MiscFrontendChanges({} as any, '/extension', 1, 1, false);
    const file = 'js/src/admin/index.js';
    const code = `const blog = app.extensionData.getAllExtensionPermissions('blog');

const seo = app.extensionData
  .getAllExtensionPermissions('seo')
  .toArray();
`;

    const result = await step.applyReplacements(file, code, step.advancedContent(file, code));

    expect(result.updated).toBe(`const blog = app.registry.getAllPermissions('blog');

const seo = app.registry.getAllPermissions('seo').toArray();
`);
  });
});
