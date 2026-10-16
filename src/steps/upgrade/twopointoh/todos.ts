import simpleGit from 'simple-git';

/**
 * The marker the upgrade leaves on code it could not change itself.
 */
export const TODO_MARKER = '@TODO';

export type Todo = {
  file: string;
  /** Null for work a step leaves without a @TODO comment in the file to show for it. */
  line: number | null;
  text: string;
};

/**
 * The TODOs a diff adds, from `git show --unified=0`.
 *
 * A line that is only reformatted or moved shows up as removed and added
 * again. When the same text was removed from the file, the TODO isn't new, so
 * an extension's own TODOs aren't reported as work the upgrade left.
 */
export function todosInDiff(diff: string): Todo[] {
  const added: Todo[] = [];
  const removed = new Map<string, string[]>();

  let file: string | null = null;
  let line = 0;

  for (const row of diff.split('\n')) {
    if (row.startsWith('+++ ')) {
      file = row === '+++ /dev/null' ? null : row.slice(4).replace(/^b\//, '');
      continue;
    }

    if (row.startsWith('--- ')) continue;

    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);

    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }

    if (file === null) continue;

    if (row.startsWith('+')) {
      if (row.includes(TODO_MARKER)) {
        added.push({ file, line, text: row.slice(1).trim() });
      }

      line++;
    } else if (row.startsWith('-')) {
      removed.set(file, [...(removed.get(file) ?? []), row.slice(1).trim()]);
    }
  }

  return added.filter((todo) => !removed.get(todo.file)?.includes(todo.text));
}

/**
 * The TODOs a commit added.
 */
export async function todosAddedBy(dir: string, commit: string): Promise<Todo[]> {
  const diff = await simpleGit(dir).show([commit, '--format=', '--unified=0', '--no-color', '--no-ext-diff', '--no-renames']);

  return todosInDiff(diff);
}
