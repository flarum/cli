import { Command, flags } from '@oclif/command';
import { IConfig } from '@oclif/config';
import cli from 'cli-ux';
import path from 'path';
import prompts from 'prompts';
import { create as createMemFs, Store } from 'mem-fs';
import { create as createMemFsEditor, Editor } from 'mem-fs-editor';
import { MemFsUtil } from '../../util/MemfsUtil';

export default class InfraBackendTesting extends Command {
  static description = 'add/update backend testing infrastructure'

  static flags = {
    help: flags.help({char: 'h'})
  }

  static args = [{
    name: 'path',
    description: 'The Flarum extension\'s directory',
    default: process.cwd(),
    parse: path.resolve
  }];

  protected fs: Editor;
  protected store: Store;
  protected promptsOptions: prompts.Options;

  constructor(argv: string[], config: IConfig) {
    super(argv, config);

    this.store = createMemFs();
    this.fs = createMemFsEditor(this.store);
    this.promptsOptions = { onCancel: () => this.exit() };
  }


  async run() {
    const { args, flags } = this.parse(InfraBackendTesting)

    const dir = args.path;

    const memFsUtil = new MemFsUtil(this.fs, dir);

    const response = await prompts([
      {
        name: 'overwriteTests',
        type: memFsUtil.exists('tests/integration/setup.php') && 'confirm',
        message: 'Test infrastructure files not empty. Overwrite with the latest version?',
      }
    ])

    if (response.overwriteTests === false) this.exit();

    const data: any = {};
    // We need this for steps that copy boilerplate files over.
    // We can't have a version of boilerplate files without this,
    // as that loses having a single source of truth.
    // TODO: Refactor so we don't need to hardcode these keys in both scripts.
    const extensionComposerJson: any = this.fs.readJSON(path.resolve(dir, 'composer.json'));
    data.packageName = extensionComposerJson.name || '';
    data.packageDescription = extensionComposerJson.description || '';
    data.license = extensionComposerJson.license || '';
    data.authorName = '';
    data.authorEmail = '';
    data.packageNamespace = (Object.keys(extensionComposerJson?.autoload["psr-4"] ?? {})[0] || '').slice(0, -1).replace("\\", "\\\\");
    data.extensionName = extensionComposerJson?.extra["flarum-extension"].title || '';


    cli.action.start("Copying over test files...");

    const boilerplateDir = path.resolve(__dirname, '../../../boilerplate');

    [
      'tests/phpunit.integration.xml',
      'tests/phpunit.unit.xml',
      'tests/fixtures/.gitkeep',
      'tests/integration/setup.php',
      'tests/unit/.gitkeep',
      '.github/workflows/test.yml'
    ].forEach(filePath => {
      this.fs.copyTpl(path.resolve(boilerplateDir, filePath), path.resolve(dir, filePath), data);
    });

    cli.action.start("Updating composer.json test scripts...");
    // We need to clear out all the template tags, which are unnecessary here.
    this.fs.copyTpl(path.resolve(boilerplateDir, 'composer.json'), path.resolve(boilerplateDir, 'composer.json.tmp'), data);
    const boilerplateComposerJson: any = this.fs.readJSON(path.resolve(boilerplateDir, 'composer.json.tmp'));

    extensionComposerJson.scripts = extensionComposerJson.scripts || {};
    extensionComposerJson['scripts-descriptions'] = extensionComposerJson['scripts-descriptions'] || {};
    extensionComposerJson['require-dev'] = extensionComposerJson['require-dev'] || {};

    Object.assign(extensionComposerJson.scripts, boilerplateComposerJson.scripts);
    Object.assign(extensionComposerJson['scripts-descriptions'], boilerplateComposerJson['scripts-descriptions']);
    Object.assign(extensionComposerJson['require-dev'], boilerplateComposerJson['require-dev']);
    this.fs.writeJSON(path.resolve(dir, 'composer.json'), extensionComposerJson);

    this.fs.delete(path.resolve(boilerplateDir, 'composer.json.tmp'));

    this.log("Test infrastructure update complete!");
    cli.action.start("Finalizing...");

    this.fs.commit(err => {
      if (err) {
        cli.action.stop("Failed");
        this.error(err);
      }

      cli.action.stop(`Successfully set up Flarum extension in ${dir}`);
    });
  };
}
