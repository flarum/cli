import cli from 'cli-ux';
import glob from 'glob';
import BaseFsCommand from '../../util/BaseFsCommand';
import { MemFsUtil } from '../../util/MemfsUtil';

const CORE_JS_NAMESPACES = ['admin', 'common', 'forum'];
const CORE_NAMESPACE_REGEX = new RegExp(`^(${CORE_JS_NAMESPACES.join('|')})/`);
const IMPORT_REGEX = /(?<key>import|export)\s+(?:(?<alias>[\w,{}\s\*]+)\s+from)?\s*(?:(["'])?(?<ref>[@\w\s\\\/.-]+)\3?)\s*;?/gm;

type ImportMap = { [name: string]: string };

export default class UpdateJsImports extends BaseFsCommand {
  static description = 'updates JS imports from core to use proper namespaces';

  static flags = { ...BaseFsCommand.flags };

  static args = [...BaseFsCommand.args];

  async run() {
    const { args } = this.parse(UpdateJsImports);

    const dir = await this.getFlarumExtensionRoot(args.path);

    await this.confirmDir(dir);

    await this.ensureComposerInstallRan(dir);

    let importMap: ImportMap = await this.compileImportMap(dir);

    const { files, importsChanged } = await this.updateJsFiles(dir, importMap);

    await this.fsCommit(dir);

    this.log(`Successfully updated ${importsChanged} core JS imports in ${files} files.`);
    this.log('Please make sure to check my work and test before commiting!!!');
  }

  async compileImportMap(dir: string): Promise<ImportMap> {
    const importMap: ImportMap = {};
    const jsSrcDir = `${dir}/vendor/flarum/core/js/src/`;

    glob.sync(`${jsSrcDir}**/*.{js,jsx,ts,tsx}`).forEach((currPath) => {
      const withNamespace = currPath.slice(jsSrcDir.length).replace(/\.(js|jsx|ts|tsx)$/, '');
      const noNamespace = withNamespace.replace(CORE_NAMESPACE_REGEX, '');

      importMap[`flarum/${noNamespace}`] = `flarum/${withNamespace}`;
    });

    return importMap;
  }

  async updateJsFiles(dir: string, importMap: ImportMap) {
    cli.action.start('Updating imports');

    let files = 0;
    let importsChanged = 0;

    glob.sync(dir + '/js/src/**/*.{js,jsx,ts,tsx}').forEach((match) => {
      let fileCounted = false;
      const currContents = this.fs.read(match);
      const newContents = currContents.replace(IMPORT_REGEX, (match, ...args) => {
        const currImport = args[3] as string;
        const currImportNoAt = currImport.replace(/^@/, '');
        const newImport = importMap[currImportNoAt] || currImport;

        if (newImport !== currImport) {
          importsChanged++;
          if (!fileCounted) {
            fileCounted = true;
            files++;
          }
        }

        return match.replace(currImport, newImport);
      });

      this.fs.write(match, newContents);
    });

    cli.action.stop();

    return { files, importsChanged };
  }
}
