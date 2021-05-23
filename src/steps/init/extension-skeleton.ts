import chalk from 'chalk';
import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';
import licenseList from 'spdx-license-list/simple';
import { ParamProvider } from '../../provider/param-provider';
import { PathProvider } from '../../provider/path-provider';
import { PhpProvider } from '../../provider/php-provider';
import { Step } from '../step-manager';

export class ExtensionSkeleton implements Step {
  type = 'Generate extension skeleton';

  composable = true;

  async run(fs: Store, pathProvider: PathProvider, paramProvider: ParamProvider, _phpProvider: PhpProvider): Promise<Store> {
    const fsEditor = create(fs);

    const packageName = await paramProvider.get<string>({
      name: 'packageName',
      type: 'text',
      message: `Package ${chalk.dim('(vendor/extension-name)')}`,
      validate: s => /^([0-9a-zA-Z-]{2,})\/([0-9a-zA-Z-]{2,})$/.test(s.trim()) || 'Invalid package name format',
      format: s => s.toLowerCase(),
    });
    const packageDescription = await paramProvider.get<string>({
      name: 'packageDescription',
      type: 'text',
      message: 'Package description',
    });
    const namespace = await paramProvider.get<string>({
      name: 'namespace',
      type: 'text',
      message: `Package namespace ${chalk.dim('(Vendor\\ExtensionName)')}`,
      validate: s => /^([0-9a-zA-Z]+)\\([0-9a-zA-Z]+)$/.test(s.trim()) || 'Invalid namespace format',
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
      validate: s => !s || /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(s) || 'Invalid email format',
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

    const tpl = {
      namespace,
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
      packageNamespace: namespace.replace(/\\/, '\\\\'),
      year: new Date().getFullYear().toString(),
    };

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

    return fs;
  }

  exposes = [];

  getExposed(_pathProvider: PathProvider, _paramProvider: ParamProvider): Record<string, unknown> {
    return {};
  }
}
