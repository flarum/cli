import pick from 'pick-deep';
import chalk from 'chalk';
import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import licenseList from 'spdx-license-list/simple';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { PhpProvider } from '../../provider/php-provider';
import { Step } from '../step-manager';
import { extensionId, extensionMetadata, ExtensionMetadata } from '../../utils/extension-metadata';

export class ExtensionSkeleton implements Step {
  type = 'Generate extension skeleton';

  composable = true;

  async run(fs: Store, pathProvider: PathProvider, paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
    const fsEditor = create(fs);

    const packageName = await paramProvider.get<string>({
      name: 'packageName',
      type: 'text',
      message: `Package ${chalk.dim('(vendor/extension-name)')}`,
      validate: s => /^([\dA-Za-z-]{2,})\/([\dA-Za-z-]{2,})$/.test(s.trim()) || 'Invalid package name format',
      format: s => s.toLowerCase(),
    });
    const packageDescription = await paramProvider.get<string>({
      name: 'packageDescription',
      type: 'text',
      message: 'Package description',
    });
    const packageNamespace = await paramProvider.get<string>({
      name: 'packageNamespace',
      type: 'text',
      message: `Package namespace ${chalk.dim('(Vendor\\ExtensionName)')}`,
      validate: s => /^([\dA-Za-z]+)\\([\dA-Za-z]+)$/.test(s.trim()) || 'Invalid namespace format',
      format: (str: string) =>
        str &&
        str
          .split('\\')
          .map(s => s[0].toUpperCase() + s.slice(1))
          .join('\\'),
    });
    const authorName = await paramProvider.get<string>({
      name: 'authorName',
      type: 'text',
      message: 'Author name',
    });
    const authorEmail = await paramProvider.get<string>({
      name: 'authorEmail',
      type: 'text',
      message: 'Author email',
      validate: s => !s || /^[\w!#$%&*+./=?^`{|}~’-]+@[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*$/.test(s) || 'Invalid email format',
    });
    const extensionName = await paramProvider.get<string>({
      name: 'extensionName',
      type: 'text',
      message: 'Extension name',
      validate: str => Boolean(str.trim()) || 'The extension name is required',
      format: str =>
        str
          .split(' ')
          .map((s: string) => (s.length > 3 ? s[0].toUpperCase() + s.slice(1) : s))
          .join(' '),
    });
    const licenseType = await paramProvider.get<string>({
      name: 'license',
      type: 'autocomplete',
      message: 'License',
      choices: [...licenseList as Set<string>].map(e => ({ title: e, value: e })),
    });
    const admin = await paramProvider.get<boolean>({
      name: 'admin',
      type: 'confirm',
      message: 'Admin CSS & JS',
      initial: true,
    });
    const forum = await paramProvider.get<boolean>({
      name: 'forum',
      type: 'confirm',
      message: 'Forum CSS & JS',
      initial: true,
    });
    const useLocale = await paramProvider.get<boolean>({
      name: 'useLocale',
      type: 'confirm',
      message: 'Locale',
      initial: true,
    });
    const useJs = await paramProvider.get<boolean>({
      name: 'useJs',
      type: () => (admin || forum) && 'confirm',
      message: 'Javascript',
      initial: true,
    });
    const useCss = await paramProvider.get<boolean>({
      name: 'useCss',
      type: () => (admin || forum) && 'confirm',
      message: 'CSS',
      initial: true,
    });
    const useActionsCi = await paramProvider.get<boolean>({
      name: 'useActionsCi',
      type: 'confirm',
      message: `Use GitHub Actions CI ${chalk.dim('(automatically builds JS, checks JS formatting and runs backend tests)')}`,
      initial: true,
    });
    const mainGitBranch = await paramProvider.get<string>({
      name: 'mainGitBranch',
      type: () => (useActionsCi && 'text'),
      message: `Main git branch ${chalk.dim('(JS will automatically build when changes are pushed to GitHub on this branch)')}`,
      // See https://stackoverflow.com/a/12093994/11091039
      validate: s => /^(?!.*\/\.)(?!.*\.\.)(?!\/)(?!.*\/\/)(?!.*@{)(?!.*\\)[^\000-\037 *:?[^~\177]+(?<!\.lock)(?<!\/)(?<!\.)$/.test(s.trim()) || 'Invalid git branch',
      initial: 'main',
    });

    const tpl: ExtensionMetadata = Object.assign(extensionMetadata(), {
      packageNamespace,
      packageName,
      packageDescription,
      authorName,
      authorEmail,
      extensionName,
      licenseType,
      admin,
      forum,
      useLocale,
      useJs,
      useCss,
      mainGitBranch,
      year: new Date().getFullYear().toString(),
      extensionId: extensionId(packageName),

      backend_directory: '.',
      frontend_directory: './js',
    });

    fsEditor.copyTpl(pathProvider.boilerplate('skeleton/extension'), pathProvider.ext(''), tpl, undefined, { globOptions: { dot: true } });

    const license = await require(`spdx-license-list/licenses/${licenseType}`);
    fsEditor.write(pathProvider.ext('LICENSE.md'), license.licenseText);

    if (!useLocale) fsEditor.delete(pathProvider.ext('locale'));
    if (!useJs) {
      fsEditor.delete(pathProvider.ext('js/.prettierrc.json'));
      fsEditor.delete(pathProvider.ext('js'));
    }

    if (!useCss) fsEditor.delete(pathProvider.ext('less'));
    if (!admin) {
      fsEditor.delete(pathProvider.ext('less/admin.less'));
      fsEditor.delete(pathProvider.ext('js/src/admin'));
      fsEditor.delete(pathProvider.ext('js/admin.js'));
    }

    if (!forum) {
      fsEditor.delete(pathProvider.ext('less/forum.less'));
      fsEditor.delete(pathProvider.ext('js/src/forum'));
      fsEditor.delete(pathProvider.ext('js/forum.js'));
    }

    if (!useActionsCi) fsEditor.delete(pathProvider.ext('.github/workflows'));

    return fs;
  }

  exposes = ['useJs'];

  getExposed(_pathProvider: PathProvider, paramProvider: ParamProvider): Record<string, unknown> {
    return pick(paramProvider.cached(), this.exposes) as ReturnType<typeof paramProvider.cached>;
  }
}
