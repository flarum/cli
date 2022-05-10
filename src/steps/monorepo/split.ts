/* eslint-disable no-await-in-loop */
import { IO } from 'boilersmith/io';
import { Paths } from 'boilersmith/paths';
import { Step } from 'boilersmith/step-manager';
import { execSync } from 'child_process';
import { Store } from 'mem-fs';
import { resolve } from 'path';
import simpleGit from 'simple-git';
import { composerPath, corePath, extensionPath, getMonorepoConf, npmPath } from '../../utils/monorepo';
import { FlarumProviders } from '../../providers';

async function addRemote(cwd: string, name: string, remote: string) {
  try {
    await simpleGit(cwd).addRemote(name, remote);
    await simpleGit(cwd).fetch(name);
  } catch {
    // ignore, remote already exists.
  }
}

async function splitAndPush(cwd: string, splitExecPath: string, splitPath: string, remoteName: string, remoteBranch?: string, force = false) {
  const currBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd }).toString().trim();
  const sha1 = execSync(`${splitExecPath} --prefix=${splitPath}`, { cwd, stdio: ['pipe', 'pipe', 'ignore'] })
    .toString()
    .trim();

  const branch = remoteBranch || 'main';

  const pushArgs = `${remoteName} "${sha1}:refs/heads/${branch}"`;
  if (force) {
    execSync(`git push --force ${pushArgs}`, { cwd });
  } else {
    const tmpBranch = `${remoteName}-tmp`;
    execSync(`git switch -c ${tmpBranch} ${sha1}`, { cwd });
    execSync(`git pull ${remoteName} ${branch} --rebase`, { cwd });
    execSync(`git push ${pushArgs}`, { cwd });
    execSync(`git switch ${currBranch}`, { cwd });
  }
}

async function cleanupBranchAndRemote(cwd: string, name: string) {
  await simpleGit(cwd).removeRemote(name);
  const tmpBranch = `${name}-tmp`;
  execSync(`git branch -D ${tmpBranch}`, { cwd });
}

export class MonorepoSplit implements Step<FlarumProviders> {
  type = 'Split monorepo changes to the respective cloned repos.';
  composable = false;
  exposes = [];
  force?: boolean;

  constructor(force: boolean) {
    this.force = force;
  }

  async run(fs: Store, paths: Paths, io: IO, _providers: FlarumProviders): Promise<Store> {
    const platform = process.platform;
    if (platform !== 'linux' && platform !== 'darwin') {
      io.error(`Your platform, "${platform}", is not supported. Split can only be run on linux and mac`, true);
      return fs;
    }

    if (this.force && !(await io.getParam({ type: 'confirm', name: 'confirm', initial: false, message: 'Are you sure you want to force split?' }))) {
      io.error('Decided not to force push', true);
      return fs;
    }

    const splitExec = resolve(__dirname, `../../../bin/splitsh-lite-${platform}`);

    const target = paths.requestedDir() ?? paths.package();

    await simpleGit(target).pull();

    const conf = getMonorepoConf(fs, paths);
    const corePkg = conf.packages.core;

    const clean = [];

    // Add Remotes
    for (const lib of conf.packages.npm ?? []) {
      await addRemote(target, lib.name, lib.gitRemote);
      await splitAndPush(target, splitExec, npmPath(lib.name), lib.name, lib.mainBranch, this.force);
      clean.push(lib.name)
    }

    for (const lib of conf.packages.composer ?? []) {
      await addRemote(target, lib.name, lib.gitRemote);
      await splitAndPush(target, splitExec, composerPath(lib.name), lib.name, lib.mainBranch, this.force);
      clean.push(lib.name)
    }

    for (const ext of conf.packages.extensions ?? []) {
      await addRemote(target, ext.name, ext.gitRemote);
      await splitAndPush(target, splitExec, extensionPath(ext.name), ext.name, ext.mainBranch, this.force);
      clean.push(ext.name)
    }

    if (corePkg) {
      await addRemote(target, corePkg.name, corePkg.gitRemote);
      await splitAndPush(target, splitExec, corePath(corePkg.name), corePkg.name, corePkg.mainBranch, this.force);
      clean.push(corePkg.name)
    }

    for (const name of clean) {
      await cleanupBranchAndRemote(target, name);
    }

    return fs;
  }

  getExposed(): Record<string, unknown> {
    throw new Error('Method not implemented.');
  }
}
