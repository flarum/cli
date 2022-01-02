export function condFormat(
  condition: boolean,
  format: (...args: string[]) => string,
  message: string | string[],
): string {
  const args = Array.isArray(message) ? message : [message];
  return condition ? format(...args) : args.join(' ');
}
