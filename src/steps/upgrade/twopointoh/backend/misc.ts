import { BaseUpgradeStep, GitCommit, Replacement } from '../base';
import chalk from 'chalk';

const MODIFYING_COLUMNS = 'https://laravel.com/docs/11.x/upgrade#modifying-columns';

export default class MiscBackendChanges extends BaseUpgradeStep {
  type = 'Miscellaneous backend changes.';

  replacements(file: string): Replacement[] {
    if (!file.endsWith('.php')) return [];

    if (file.startsWith('migrations/')) {
      return [this.flagColumnChanges()];
    }

    return [
      (file, code) => ({
        updated: this.php!.run('upgrade.2-0.misc', { file, code }).code,
      }),
    ];
  }

  targets(): string[] {
    return ['extend.php', 'src/**/*', 'migrations/**/*.php'];
  }

  gitCommit(): GitCommit {
    return {
      message: 'chore(2.0): misc backend changes',
      description: 'Miscellaneous backend changes',
    };
  }

  /**
   * Since Laravel 11, changing a column drops every attribute the change
   * leaves out, so a migration's ->change() must repeat the whole column
   * definition. Only the author knows the column's full definition.
   */
  flagColumnChanges(): Replacement {
    return (file, code) => {
      if (/->\s*change\s*\(\s*\)/.test(code)) {
        this.leaveTodo(
          file,
          `It changes a column with ->change(), which now drops every attribute the change leaves out: repeat the column's whole definition. ${MODIFYING_COLUMNS}`
        );
      }

      return null;
    };
  }

  pauseMessage(): string {
    const link = 'https://docs.flarum.org/2.x/extend/update-2_0#miscellaneous-1';
    const readMore = chalk.dim(`Read more: ${link}`);

    return `Various breaking backend changes have been made in 2.0. The tool has attempted to update your code accordingly.
                     Please review the changes and ensure everything is correct.
                     ${readMore}`;
  }
}
