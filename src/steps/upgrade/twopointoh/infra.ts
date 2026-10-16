import simpleGit from 'simple-git';
import { AdvancedContent, BaseUpgradeStep, GitCommit, Replacement } from './base';

// Where 1.x extensions got core's global typings from, and where 2.x ones get
// the global typings of every Flarum package they depend on.
const CORE_GLOBAL_TYPINGS = '"../vendor/flarum/core/js/dist-typings/@types/**/*"';
const VENDOR_GLOBAL_TYPINGS = '"../vendor/*/*/js/dist-typings/@types/**/*"';

const indentation = (line: string): number => line.length - line.trimStart().length;

/**
 * Drop a workflow's `php_versions` input, so the reusable workflow tests the
 * PHP versions Flarum 2.0 supports and keeps up as that changes. A `with:`
 * left without inputs goes too.
 */
function dropPhpVersions(code: string): string {
  const lines = code.split('\n');
  const kept: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*php_versions:/.test(lines[i])) {
      kept.push(lines[i]);
      continue;
    }

    // A folded or literal value continues on the more indented lines below.
    while (i + 1 < lines.length && lines[i + 1].trim() !== '' && indentation(lines[i + 1]) > indentation(lines[i])) {
      i++;
    }
  }

  return kept
    .filter((line, i) => {
      if (!/^\s*with:\s*(#.*)?$/.test(line)) return true;

      const next = kept.slice(i + 1).find((other) => other.trim() !== '');

      return next !== undefined && indentation(next) > indentation(line);
    })
    .join('\n');
}

export default class Infrastructure extends BaseUpgradeStep {
  type = 'Update the extension infrastructure.';

  replacements(file: string): Replacement[] {
    const replacements = [];

    if (file.endsWith('.yml')) {
      replacements.push(this.updateWorkflow());
    }

    if (file.endsWith('.neon')) {
      replacements.push(this.updatePhpStan());
    }

    if (file === 'js/tsconfig.json') {
      replacements.push(this.updateTsConfigInclude());
    }

    return replacements;
  }

  targets(): string[] {
    return ['.github/workflows/*.yml', 'phpstan.neon', 'js/tsconfig.json'];
  }

  // Every file is only edited as text: a tsconfig.json the JSON parser can't
  // read shouldn't stop the workflows being updated.
  advancedContent(_file: string, _code: string): AdvancedContent {
    return null;
  }

  gitCommit(): GitCommit {
    return {
      message: 'chore(2.0): update infrastructure',
      description: 'Update the extension infrastructure',
    };
  }

  pauseMessage(): string {
    return 'Infrastructure updated. Please review the changes then proceed.';
  }

  updateWorkflow(): Replacement {
    return async (_file, code) => ({
      updated: await this.updateMainGitBranch(
        dropPhpVersions(
          code
            .replace('REUSABLE_backend.yml@1.x', 'REUSABLE_backend.yml@2.x')
            .replace('REUSABLE_frontend.yml@1.x', 'REUSABLE_frontend.yml@2.x')
            .replace('REUSABLE_backend.yml@main', 'REUSABLE_backend.yml@2.x')
            .replace('REUSABLE_frontend.yml@main', 'REUSABLE_frontend.yml@2.x')
        )
      ),
    });
  }

  /**
   * The reusable frontend workflow commits the built JS to `main_git_branch`,
   * which still names 1.x. Point it at a 2.x branch when there is one. Other
   * values are left alone: an extension's 2.x code is often on main.
   */
  async updateMainGitBranch(code: string): Promise<string> {
    const setting = /^([\t ]*)main_git_branch:([\t ]*)(["']?)1\.x\3/m;
    const match = code.match(setting);

    if (!match) return code;

    if (await this.hasBranch('2.x')) {
      return code.replace(setting, (_line, indent, space, quote) => `${indent}main_git_branch:${space}${quote}2.x${quote}`);
    }

    const todo = `${match[1]}# @TODO: Set main_git_branch to the branch your Flarum 2.x code is on. The built JS is committed to it.`;

    // An earlier run already left it.
    if (code.includes(todo)) return code;

    return code.replace(setting, (line) => `${todo}\n${line}`);
  }

  /** Whether the extension's repository has the branch, locally or on a remote. */
  protected async hasBranch(name: string): Promise<boolean> {
    try {
      const branches = await simpleGit(this.root).branch(['--all']);

      return branches.all.some((branch) => branch === name || (branch.startsWith('remotes/') && branch.endsWith(`/${name}`)));
    } catch {
      return false;
    }
  }

  /**
   * Read the global typings of every Flarum package in vendor, as a new
   * extension does, not only core's. The file is edited as text so its
   * comments stay.
   */
  updateTsConfigInclude(): Replacement {
    return (_file, code) => {
      if (!code.includes(CORE_GLOBAL_TYPINGS) || code.includes(VENDOR_GLOBAL_TYPINGS)) return null;

      return { updated: code.replace(CORE_GLOBAL_TYPINGS, VENDOR_GLOBAL_TYPINGS) };
    };
  }

  updatePhpStan(): Replacement {
    return (_file, code) => ({
      updated: code
        // remove lines
        // checkMissingIterableValueType: false
        // checkGenericClassInNonGenericObjectType: false
        .replace(/^(\s+checkMissingIterableValueType: false\n|\s+checkGenericClassInNonGenericObjectType: false\n)/gm, ''),
    });
  }
}
