/**
 * Whether output goes to a terminal, rather than to a file or another program.
 */
export function isTerminal(): boolean {
  return Boolean(process.stdout.isTTY);
}

/**
 * Moves the cursor up a line, so the next one overwrites it. Only in a
 * terminal: anywhere else the escape code is noise.
 */
export function overwrite(): string {
  return isTerminal() ? '\u001B[A' : '';
}

/**
 * The text without colours or cursor movement.
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001B\[[\d;]*[A-Za-z]/g, '');
}
