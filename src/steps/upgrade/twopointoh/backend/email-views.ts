import ejs from 'ejs';
import { BaseUpgradeStep, GitCommit, Replacement } from '../base';

/** Where a view lives: `acme-thing::emails.launched` is in `.../emails/launched.blade.php`. */
const viewFile = (view: string): string => '/' + view.split('::').pop()!.replace(/\./g, '/') + '.blade.php';

export default class EmailViews extends BaseUpgradeStep {
  type = 'Email notifications now require both Plain Text and HTML views.';

  protected collected: {
    [file: string]: {
      html: string;
      text: string;
    };
  } = {};

  protected templates = {
    html: '/../../../../../boilerplate/stubs/views/email/html/notification.blade.php',
    text: '/../../../../../boilerplate/stubs/views/email/plain/notification.blade.php',
  };

  replacements(file: string): Replacement[] {
    if (!file.endsWith('.php')) return [];

    return [
      async (file, code) => {
        if (!code.includes('MailableInterface')) {
          return null;
        }

        const output = this.php!.run('upgrade.2-0.email-views', { file, code });

        this.collected[file] = output.collected;

        return {
          updated: output.code,
        };
      },
      async (file, code) => {
        const newFiles: { path: string; code: string }[] = [];

        for (const views of Object.values(this.collected)) {
          // A notification that has both views already has nothing to convert,
          // such as one already upgraded to 2.0.
          if (!views || Boolean(views.html) === Boolean(views.text)) continue;

          const view = views.html || views.text;

          // The view's own file, by its full path: on 2.x the html and plain
          // views of a notification have the same file name.
          if (!file.endsWith(viewFile(view))) continue;

          const viewFileName = view.split('::')[1].split('.').pop();

          for (const viewType of ['text', 'html'] as const) {
            const templateContent = this.fsEditor!.read(__dirname + this.templates[viewType]);
            const viewTypePath = viewType === 'text' ? 'plain' : 'html';

            newFiles.push({
              path: file.split('/views/')[0] + '/views/email/' + viewTypePath + '/' + viewFileName + '.blade.php',
              code: ejs.render(templateContent, { content: code.trimEnd() }),
            });
          }
        }

        return newFiles.length > 0 ? { updated: code, delete: true, newFiles } : null;
      },
    ];
  }

  targets(): string[] {
    return ['src/**/*', 'views/**/*.blade.php', 'resources/views/**/*.blade.php'];
  }

  gitCommit(): GitCommit {
    return {
      message: 'chore(2.0): notification emails now require both plain text and HTML views',
      description: 'You now need to provide both plain text and HTML views for notification emails.',
    };
  }

  pauseMessage(): string {
    return `Flarum 2.0 requires both plain text and HTML views for notification emails.
                     The upgrader has attempted to convert your email views to include both.
                     Please review the changes and ensure that both views are present. Then proceed.`;
  }
}
