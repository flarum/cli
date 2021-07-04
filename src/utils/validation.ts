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

  public static migrationName(s: string) {
    return /^[0-9a-zA-Z_ ]+$/.test(s.trim()) || 'Field is required; alphanumerical characters, underscores, and spaces only!';
  }

  public static tableName(s: string) {
    return /^[0-9,a-z,A-Z$_]{0,64}$/.test(s.trim()) || 'Invalid table name, must be less than 64 alphanumerical characters.';
  }
}
