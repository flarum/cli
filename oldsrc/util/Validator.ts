export default class Validator {
  public static class(s: string) {
    return /^([0-9a-zA-Z]+)(\\([0-9a-zA-Z]+))*$/.test(s.trim()) || 'Invalid PHP class. Must be qualified, but not fully qualified.'
  }

  public static className(s: string) {
    return /^([0-9a-zA-Z]+)/.test(s.trim()) || 'Invalid PHP class name: only alphanumerical characters allowed.'
  }
}
