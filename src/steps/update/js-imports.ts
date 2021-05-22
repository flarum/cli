import { glob } from 'glob';
import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { PhpProvider } from '../../provider/php-provider';
import { Step } from '../step-manager';

const CORE_JS_NAMESPACES = ['admin', 'common', 'forum'];
const CORE_NAMESPACE_REGEX = new RegExp(`^(${CORE_JS_NAMESPACES.join('|')})/`);
const IMPORT_REGEX = /(?<key>import|export)\s+(?:(?<alias>[\w,{}\s*]+)\s+from)?\s*(?:(["'])?(?<ref>[@\w\s\\/.-]+)\3?)\s*;?/gm;

type ImportMap = Record<string, string>;

export class UpdateJSImports implements Step {
  name = 'Use full flarum/namespace in JS imports';

  composable = false;

  async run(fs: Store, pathProvider: PathProvider, _paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
    const fsEditor = create(fs);

    const importMap: ImportMap = {};
    const jsSrcDir = pathProvider.ext('vendor/flarum/core/js/src');

    const vendorRegex = new RegExp(`${jsSrcDir}/.*(js|jsx|ts|tsx)`);
    const fsVendorFilePaths = fs.all().map(file => file.path).filter(path => path && vendorRegex.test(path));
    const persistedVendorFilePaths = glob.sync(`${jsSrcDir}**/*.{js,jsx,ts,tsx}`);

    [...fsVendorFilePaths, ...persistedVendorFilePaths]
      .forEach(currPath => {
        const withNamespace = currPath.slice(jsSrcDir.length + 1).replace(/\.(js|jsx|ts|tsx)$/, '');
        const noNamespace = withNamespace.replace(CORE_NAMESPACE_REGEX, '');

        importMap[`flarum/${noNamespace}`] = `flarum/${withNamespace}`;
      });

    const srcRegex = new RegExp(`${pathProvider.ext('js/src')}/.*(js|jsx|ts|tsx)`);
    const fsSrcFilePaths = fs.all().map(file => file.path).filter(path => path && srcRegex.test(path));
    const persistedSrcFilePaths = glob.sync(pathProvider.ext('/js/src/**/*.{js,jsx,ts,tsx}'));

    [...fsSrcFilePaths, ...persistedSrcFilePaths]
      .forEach(match => {
        let fileCounted = false;
        const currContents = fsEditor.read(match);
        const newContents = currContents.replace(IMPORT_REGEX, (match, ...args) => {
          const currImport = args[3] as string;
          const currImportNoAt = currImport.replace(/^@/, '');
          const newImport = importMap[currImportNoAt] || currImport;

          if (newImport !== currImport) {
            if (!fileCounted) {
              fileCounted = true;
            }
          }

          return match.replace(currImport, newImport);
        });

        fsEditor.write(match, newContents);
      });

    return fs;
  }
}
