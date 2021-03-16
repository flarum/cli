import cli from 'cli-ux';
import path from 'path';
import prompts from 'prompts';
import BaseFsCommand from '../../util/BaseFsCommand';
import { MemFsUtil } from '../../util/MemfsUtil';

export default class InfraBackendTesting extends BaseFsCommand {
  static description = 'add/update backend testing infrastructure'

  static flags = {...BaseFsCommand.flags};

  static args = [...BaseFsCommand.args];

  async run() {
    const { args } = this.parse(InfraBackendTesting);

    const dir = await this.getFlarumExtensionRoot(args.path);

    await this.confirmDir(dir);

    await this.existingTestsCheck(dir);

    const boilerplateDir = this.getBoilerplateDir('init');
    const fakeInitData = this.simulateInitPromptData(dir);

    await this.copyInfraFiles(dir, boilerplateDir, fakeInitData);

    await this.updateComposerJsonFields(dir, boilerplateDir, fakeInitData);

    await this.fsCommit(dir);
  };

  protected async existingTestsCheck(dir: string) {
    const memFsUtil = new MemFsUtil(this.fs, dir);
    if (!memFsUtil.exists('tests/integration/setup.php')) return;

    const response = await prompts([
      {
        name: 'overwriteTests',
        type: 'confirm',
        message: 'Test infrastructure files already exist. Overwrite with the latest version?',
      }
    ])

    if (response.overwriteTests === false) this.exit();
  }

  protected async copyInfraFiles(extDir: string, boilerplateDir: string, fakeInitData: any) {
    cli.action.start("Copying over test infrastructure files...");

    const infraFiles = [
      'tests/phpunit.integration.xml',
      'tests/phpunit.unit.xml',
      'tests/fixtures/.gitkeep',
      'tests/integration/setup.php',
      'tests/unit/.gitkeep',
      '.github/workflows/test.yml'
    ];

    infraFiles.forEach(filePath => {
      this.fs.copyTpl(path.resolve(boilerplateDir, filePath), path.resolve(extDir, filePath), fakeInitData);
    });

    cli.action.stop();
  }

  protected async updateComposerJsonFields(extDir: string, boilerplateDir: string, fakeInitData: any) {
    cli.action.start("Updating composer.json test scripts...");

    // We copy it to resolve template tags.
    this.fs.copyTpl(path.resolve(boilerplateDir, 'composer.json'), path.resolve(boilerplateDir, 'composer.json.tmp'), fakeInitData);
    const boilerplateComposerJson: any = this.fs.readJSON(path.resolve(boilerplateDir, 'composer.json.tmp'));
    this.fs.delete(path.resolve(boilerplateDir, 'composer.json.tmp'));

    const extensionComposerJson: any = this.fs.readJSON(path.resolve(extDir, 'composer.json'));

    // Init these values in case they are empty.
    extensionComposerJson.scripts = extensionComposerJson.scripts || {};
    extensionComposerJson['scripts-descriptions'] = extensionComposerJson['scripts-descriptions'] || {};
    extensionComposerJson['require-dev'] = extensionComposerJson['require-dev'] || {};

    Object.assign(extensionComposerJson.scripts, boilerplateComposerJson.scripts);
    Object.assign(extensionComposerJson['scripts-descriptions'], boilerplateComposerJson['scripts-descriptions']);
    Object.assign(extensionComposerJson['require-dev'], boilerplateComposerJson['require-dev']);
    this.fs.writeJSON(path.resolve(extDir, 'composer.json'), extensionComposerJson);

    cli.action.stop();
  }
}
