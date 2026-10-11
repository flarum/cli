import { BaseUpgradeStep, GitCommit, Replacement } from './base';

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

    return replacements;
  }

  targets(): string[] {
    return ['.github/workflows/*.yml', 'phpstan.neon'];
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
    return (_file, code) => ({
      updated: dropPhpVersions(
        code
          .replace('REUSABLE_backend.yml@1.x', 'REUSABLE_backend.yml@2.x')
          .replace('REUSABLE_frontend.yml@1.x', 'REUSABLE_frontend.yml@2.x')
          .replace('REUSABLE_backend.yml@main', 'REUSABLE_backend.yml@2.x')
          .replace('REUSABLE_frontend.yml@main', 'REUSABLE_frontend.yml@2.x')
      ),
    });
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
