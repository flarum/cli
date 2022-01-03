import globby from 'globby';
import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { DefaultProviders, Step } from 'boilersmith/step-manager';

const CORE_JS_NAMESPACES = ['admin', 'common', 'forum'];
const CORE_NAMESPACE_REGEX = new RegExp(`^(${CORE_JS_NAMESPACES.join('|')})/`);
const IMPORT_REGEX = /(?<key>import|export)\s+(?:(?<alias>[\s\w*,{}]+)\s+from)?\s*(["'])?(?<ref>[\s\w./@\\-]+)\3?\s*;?/gm;

type ImportMap = Record<string, string>;

export class UpdateJSImports implements Step {
  type = 'Use full flarum/namespace in JS imports';

  composable = false;

  async run(fs: Store, paths: Paths, _paramProvider: IO, _providers: DefaultProviders): Promise<Store> {
    const fsEditor = create(fs);

    const importMap: ImportMap = {};
    const jsSrcDir = paths.package('vendor/flarum/core/js/src');

    const vendorRegex = new RegExp(`${jsSrcDir}/.*(js|jsx|ts|tsx)`);
    const fsVendorFilePaths = fs.all().map(file => file.path).filter(path => path && vendorRegex.test(path));
    const persistedVendorFilePaths = globby.sync(`${jsSrcDir}/**/*.{js,jsx,ts,tsx}`);

    for (const currPath of [...fsVendorFilePaths, ...persistedVendorFilePaths]) {
      const withNamespace = currPath.slice(jsSrcDir.length + 1).replace(/\.(js|jsx|ts|tsx)$/, '');
      const noNamespace = withNamespace.replace(CORE_NAMESPACE_REGEX, '');

      importMap[`flarum/${noNamespace}`] = `flarum/${withNamespace}`;
    }

    const srcRegex = new RegExp(`${paths.package('js/src')}/.*(js|jsx|ts|tsx)`);
    const fsSrcFilePaths = fs.all().map(file => file.path).filter(path => path && srcRegex.test(path));
    const persistedSrcFilePaths = globby.sync(paths.package('js/src/**/*.{js,jsx,ts,tsx}'));

    for (const match of [...fsSrcFilePaths, ...persistedSrcFilePaths]) {
      let fileCounted = false;
      const currContents = fsEditor.read(match);
      const newContents = currContents.replace(IMPORT_REGEX, (match, ...args) => {
        const currImport = args[3] as string;
        const currImportNoAt = currImport.replace(/^@/, '');
        const newImport = importMap[currImportNoAt] || currImport;

        if (newImport !== currImport && !fileCounted) {
          fileCounted = true;
        }

        return match.replace(currImport, newImport);
      });

      fsEditor.write(match, newContents);
    }

    return fs;
  }

  exposes = [];

  getExposed(_paths: Paths, _paramProvider: IO): Record<string, unknown> {
    return {};
  }
}
