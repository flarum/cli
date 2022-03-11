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
  } catch {
    // ignore, remote already exists.
  }
}

async function splitAndPush(cwd: string, splitExecPath: string, splitPath: string, remoteName: string, remoteBranch?: string) {
  const sha1 = execSync(`${splitExecPath} --prefix=${splitPath}`, { cwd, stdio: ['pipe', 'pipe', 'ignore'] })
    .toString()
    .trim();
  execSync(`git push ${remoteName} "${sha1}:refs/heads/${remoteBranch || 'main'}"`, { cwd });
}

async function removeRemote(cwd: string, name: string) {
  await simpleGit(cwd).removeRemote(name);
}

export class MonorepoSplit implements Step<FlarumProviders> {
  type = 'Split monorepo changes to the respective cloned repos.';
  composable = false;
  exposes = [];

  async run(fs: Store, paths: Paths, io: IO, _providers: FlarumProviders): Promise<Store> {
    const platform = process.platform;
    if (platform !== 'linux' && platform !== 'darwin') {
      io.error(`Your platform, "${platform}", is not supported. Split can only be run on linux and mac`, true);
      return fs;
    }

    const splitExec = resolve(__dirname, `../../../bin/splitsh-lite-${platform}`);

    const target = paths.requestedDir() ?? paths.package();

    await simpleGit(target).pull();

    const conf = getMonorepoConf(fs, paths);
    const corePkg = conf.packages.core;

    // Add Remotes
    for (const lib of conf.packages.npm ?? []) {
      await addRemote(target, lib.name, lib.gitRemote);
      await splitAndPush(target, splitExec, npmPath(lib.name), lib.name, lib.mainBranch).finally(() => {
        return removeRemote(target, lib.name);
      });
    }

    for (const lib of conf.packages.composer ?? []) {
      await addRemote(target, lib.name, lib.gitRemote);
      await splitAndPush(target, splitExec, composerPath(lib.name), lib.name, lib.mainBranch).finally(() => {
        return removeRemote(target, lib.name);
      });
    }

    for (const ext of conf.packages.extensions ?? []) {
      await addRemote(target, ext.name, ext.gitRemote);
      await splitAndPush(target, splitExec, extensionPath(ext.name), ext.name, ext.mainBranch).finally(() => {
        return removeRemote(target, ext.name);
      });
    }

    if (corePkg) {
      await addRemote(target, corePkg.name, corePkg.gitRemote);
      await splitAndPush(target, splitExec, corePath(corePkg.name), corePkg.name, corePkg.mainBranch).finally(() => {
        return removeRemote(target, corePkg.name);
      });
    }

    return fs;
  }

  getExposed(): Record<string, unknown> {
    throw new Error('Method not implemented.');
  }
}
