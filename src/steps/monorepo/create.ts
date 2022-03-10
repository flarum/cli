/* eslint-disable no-await-in-loop */
import { execSync } from 'child_process';
import { Store } from 'mem-fs';
import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { Step } from 'boilersmith/step-manager';
import { FlarumProviders } from '../../providers';
import { Scaffolder } from 'boilersmith/scaffolding/scaffolder';
import { ExtensionModules, ExtensionParams } from '../gen-ext-scaffolder';
import { composerPath, corePath, extensionPath, FlarumMonorepoJsonSchema, npmPath } from '../../utils/monorepo';
import { condFormat } from 'boilersmith/utils/cond-format';
import chalk from 'chalk';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import simpleGit from 'simple-git';
import { create } from 'mem-fs-editor';
import { commitAsync } from 'boilersmith/utils/commit-async';
import { Validator } from '../../utils/validation';

async function addGitPackage(cwd: string, path: string, remote: string, mainBranch: string | null = 'main') {
  const tmpDir = mkdtempSync(resolve(tmpdir(), `${path.replace('/', '_')}-`));

  execSync(`git clone ${remote} ${tmpDir} --verbose --branch ${mainBranch} --single-branch`, { cwd });
  execSync(`git filter-repo --to-subdirectory-filter ${path}`, { cwd: tmpDir });
  if (mainBranch) {
    await simpleGit(tmpDir).checkout(mainBranch);
  }

  await simpleGit(tmpDir).branch(['REWRITE']);
  await simpleGit(tmpDir).checkout('REWRITE');

  // Merge from remote
  const remoteName = path.replace('/', '_').replace('-', '_');
  await simpleGit(cwd).addRemote(remoteName, tmpDir);

  execSync(`git fetch ${remoteName}`, { cwd });
  execSync(`git merge ${remoteName}/REWRITE --allow-unrelated-histories --no-edit`, { cwd });
  await simpleGit(cwd).removeRemote(remoteName);
  rmSync(tmpDir, { recursive: true, force: true });
}

function makeRunCommitStep(cwd: string, fs: Store, io: IO, paths: Paths, providers: FlarumProviders) {
  return async function (packagePaths: string[], step: Step<FlarumProviders>, message: string | string[]) {
    for (const path of packagePaths) {
      await step.run(fs, paths.onMonorepoSub(resolve(cwd, path), cwd), io, providers);
    }

    await commitAsync(fs);
    await commitAll(cwd, message);
  };
}

async function getMonorepoConf(io: IO, monorepoConfPath?: string): Promise<FlarumMonorepoJsonSchema> {
  if (monorepoConfPath) {
    return JSON.parse(readFileSync(monorepoConfPath, 'utf8'));
  }

  const packages: FlarumMonorepoJsonSchema['packages'] = { extensions: [], composer: [], npm: [] };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const confirm = await io.getParam(
      {
        name: 'confirm',
        type: 'confirm',
        initial: true,
        message: 'Add another package to monorepo?',
      },
      true
    );

    if (!confirm) break;

    const packageType = (await io.getParam(
      {
        name: 'packageType',
        message: 'Package Type',
        type: 'select',
        choices: [
          { title: 'Flarum Extension', value: 'extensions' },
          { title: 'Composer PHP Package', value: 'composer' },
          { title: 'NPM JS/TS Package', value: 'npm' },
          { title: 'Flarum Core', value: 'core' },
        ],
        validate: (value) => value !== 'core' || !packages.core || 'A core package has already been specified.',
      },
      true
    )) as 'extensions' | 'composer' | 'npm' | 'core';

    const packageName = await io.getParam(
      {
        name: 'name',
        message: 'Package Name (used to generate subdirectory path)',
        type: 'text',
        validate: Validator.fileName,
      },
      true
    );

    const gitRemote = await io.getParam(
      {
        name: 'remote',
        message: 'Git remote (e.g. git@github.com:flarum/core.git)',
        type: 'text',
        validate: Validator.gitRepo,
      },
      true
    );

    const packageInfo = {
      name: packageName,
      gitRemote,
    };

    if (packageType === 'core') {
      packages.core = packageInfo;
    } else {
      const typePackages = packages[packageType] ?? [];
      typePackages.push(packageInfo);
      packages[packageType] = typePackages;
    }
  }

  return { packages };
}

async function commitAll(cwd: string, message: string | string[]) {
  await simpleGit(cwd).add('.');
  await simpleGit(cwd).commit(message);
}

export class MonorepoCreate implements Step<FlarumProviders> {
  type = 'Create a monorepo of Flarum extensions';

  composable = false;

  protected monorepoConfPath?: string;
  protected scaffolder: Scaffolder<ExtensionParams, ExtensionModules>;

  constructor(scaffolder: Scaffolder<ExtensionParams, ExtensionModules>, monorepoConfPath?: string) {
    this.scaffolder = scaffolder;
    this.monorepoConfPath = monorepoConfPath;
  }

  async run(fs: Store, paths: Paths, io: IO, providers: FlarumProviders): Promise<Store> {
    const target = paths.requestedDir() ?? paths.package('flarum_monorepo');
    const confirmTarget = await io.getParam({
      name: 'confirmTarget',
      message: `Create monorepo in directory: "${condFormat(io.supportsAnsiColor, chalk.dim, target)}" (will be overwritten)?`,
      type: 'confirm',
      initial: true,
    });

    if (!confirmTarget) {
      io.error('Target not confirmed', true);
      return fs;
    }

    const conf = await getMonorepoConf(io, this.monorepoConfPath ? paths.cwd(this.monorepoConfPath) : undefined);

    const runCommitStep = makeRunCommitStep(target, fs, io, paths, providers);

    rmSync(target, { recursive: true, force: true });
    mkdirSync(target);

    await simpleGit(target).init();

    for (const lib of conf.packages.npm ?? []) {
      await addGitPackage(target, npmPath(lib.name), lib.gitRemote, lib.mainBranch);
    }

    for (const lib of conf.packages.composer ?? []) {
      await addGitPackage(target, composerPath(lib.name), lib.gitRemote, lib.mainBranch);
    }

    for (const ext of conf.packages.extensions ?? []) {
      await addGitPackage(target, extensionPath(ext.name), ext.gitRemote, ext.mainBranch);
    }

    const corePkg = conf.packages.core;
    if (corePkg) {
      await addGitPackage(target, corePath(corePkg.name), corePkg.gitRemote, corePkg.mainBranch);
    }

    const npmPaths = conf.packages.npm?.map((lib) => npmPath(lib.name)) ?? [];
    const composerPaths = conf.packages.composer?.map((lib) => composerPath(lib.name)) ?? [];
    const flarumPaths = conf.packages.extensions?.map((ext) => extensionPath(ext.name)) ?? [];
    if (corePkg) {
      flarumPaths.push(corePath(corePkg.name));
    }

    flarumPaths.forEach((path) => {
      rmSync(resolve(target, path, '.github'), { force: true, recursive: true });
    });

    [...npmPaths, ...composerPaths, ...flarumPaths].forEach((path) => {
      rmSync(resolve(target, path, '.styleci.yml'), { force: true });
    });

    await commitAll(target, [
      'chore: remove centralizable repo config',
      '- Remove .github conf folder from Flarum packages',
      '- Remove styleci config from all packages',
    ]);

    create(fs).writeJSON(resolve(target, 'flarum-monorepo.json'), conf);
    await commitAsync(fs);
    await commitAll(target, 'chore: add monorepo config file');

    [...composerPaths, ...flarumPaths].forEach((path) => {
      const cwd = resolve(target, path);
      execSync('composer config repositories.0 path "../*"', { cwd });
      execSync('composer config minimum-stability dev', { cwd });
      execSync('composer config prefer-stable true', { cwd });
      const composerJsonPath = resolve(cwd, 'composer.json');
      const composerJson = readFileSync(composerJsonPath);
      writeFileSync(composerJsonPath, composerJson.toString().replace('"dev-master": "1.x-dev"', '"dev-main": "1.x-dev"'));
    });

    [...composerPaths, ...flarumPaths].forEach((path) => {
      const cwd = resolve(target, path);
      execSync('composer install --dry-run --no-interaction --no-ansi --no-progress --no-scripts --no-autoloader', { cwd });
    });

    await commitAll(target, 'chore: set up composer path repos');

    create(fs).writeJSON(resolve(target, 'flarum-monorepo.json'), conf);
    await commitAsync(fs);
    await commitAll(target, 'chore: add monorepo config file');

    await runCommitStep(flarumPaths, this.scaffolder.genAuditStep(false), 'chore: flarum-cli audit infra --fix');

    return fs;
  }

  exposes = [];

  getExposed(): Record<string, unknown> {
    return {};
  }
}
