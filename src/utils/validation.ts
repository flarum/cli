export class Validator {
  public static class(s: string) {
    return /^([0-9a-zA-Z]+)(\\([0-9a-zA-Z]+))*$/.test(s.trim()) || 'Invalid PHP class. Must be qualified, but not fully qualified.';
  }

  public static className(s: string) {
    return /^([0-9a-zA-Z]+)$/.test(s.trim()) || 'Invalid PHP class name: only alphanumerical characters allowed.';
  }

  public static routeName(s: string) {
    return /^([A-z-._0-9]+)$/.test(s.trim()) || 'Invalid path name: only alphanumerical characters allowed and (._-).';
  }
}
