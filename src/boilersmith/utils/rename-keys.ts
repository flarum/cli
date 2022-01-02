export function renameKeys(obj: Record<string, unknown>, func: (key: string, val: unknown) => string): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, val]) => [func(key, val), val]),
  );
}
