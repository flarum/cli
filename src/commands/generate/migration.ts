import cli from 'cli-ux';
import filesystem from 'fs';
import path from 'path';
import prompts from 'prompts';
import BaseFsCommand from '../../util/BaseFsCommand';

export default class GenerateMigration extends BaseFsCommand {
  static description = 'generate an empty migration template';

  static flags = { ...BaseFsCommand.flags };

  static args = [...BaseFsCommand.args];

  async run() {
    const { args, flags } = this.parse(GenerateMigration);

    const dir = await this.getFlarumExtensionRoot(args.path);

    await this.confirmDir(dir);

    await this.generateMigration(dir);

    await this.fsCommit(dir);
  }

  protected async generateMigration(dir: string) {
    const response = await prompts([
      {
        name: 'name',
        type: 'text',
        message: `Migration name/short description`,
        validate: (s) => /^[0-9a-zA-Z_ ]+$/.test(s.trim()) || 'Field is required; alphanumerical characters, underscores, and spaces only!',
        format: (str) => str.toLowerCase().replace(/ /g, '_'),
      },
    ]);

    cli.action.start('Creating migration...');

    const migrationNumber = this.getNextMigrationNumber(dir);

    const now = new Date();

    const pad = (val: number, len: number) => String(val).padStart(len, '0');

    const name = `${pad(now.getFullYear(), 4)}_${pad(now.getMonth(), 2)}_${pad(now.getDate(), 2)}_${pad(migrationNumber, 6)}_${response.name}.php`;

    const boilerplateDir = this.getBoilerplateDir('generate');

    this.fs.copyTpl(path.resolve(boilerplateDir, 'migration.php'), path.resolve(dir, 'migrations', name), this.simulateInitPromptData(dir));

    cli.action.stop();
  }

  protected getNextMigrationNumber(dir: string): number {
    const migrations = filesystem.readdirSync(path.resolve(dir, 'migrations'));

    for (let migration of migrations.sort().reverse()) {
      const match = migration.match(/^(\d{4})_(\d{2})_(\d{2})_(\d{6})_(.*)\.php/);
      if (!match) continue;

      const now = new Date();

      if (parseInt(match[1]) === now.getFullYear() && parseInt(match[2]) === now.getMonth() && parseInt(match[3]) === now.getDate()) {
        return parseInt(match[4]) + 1;
      }
    }

    return 0;
  }
}
