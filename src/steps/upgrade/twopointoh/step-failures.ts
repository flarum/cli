import chalk from 'chalk';

type Failure = {
  file: string;
  reason: string;
};

/**
 * The files a single upgrade step could not transform.
 *
 * A step runs over every matching file in an extension, and any one of them
 * can defeat it — a parser that doesn't recognise some syntax, a transformer
 * meeting a shape it wasn't written for. Collecting those instead of throwing
 * at the first means the author is told about all of them at once, and fixes
 * them in one pass rather than rediscovering them one re-run at a time.
 */
export class StepFailures {
  private failures: Failure[] = [];

  record(file: string, error: unknown): void {
    this.failures.push({ file, reason: StepFailures.reasonFor(error) });
  }

  any(): boolean {
    return this.failures.length > 0;
  }

  count(): number {
    return this.failures.length;
  }

  /**
   * The failures, formatted for the author: which file, and why.
   */
  report(): string {
    return this.failures.map(({ file, reason }) => `     ${chalk.bold(file)}\n       ${reason}`).join('\n\n');
  }

  /**
   * The message alone. A stack trace is about our internals, not about the
   * code being upgraded, so it isn't what the author needs to see.
   */
  private static reasonFor(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return JSON.stringify(error);
  }
}
