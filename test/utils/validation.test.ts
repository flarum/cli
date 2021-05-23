import { Validator } from '../../src/utils/validation';

describe('Validator', function () {
  describe('#class', function () {
    const error = 'Invalid PHP class. Must be qualified, but not fully qualified.';
    it('Accepts valid classes', function () {
      expect(Validator.class('Hello')).toBe(true);
      expect(Validator.class('Hello\\There')).toBe(true);
      expect(Validator.class('Hello\\There\\This\\Could\\Go\\On\\Forever')).toBe(true);
    });

    it('Rejects qualified', function () {
      expect(Validator.class('\\Hello')).toBe(error);
      expect(Validator.class('\\Hello\\There')).toBe(error);
      expect(Validator.class('\\Hello\\There\\This\\Could\\Go\\On\\Forever')).toBe(error);
    });

    it('Rejects obviously incorrect', function () {
      expect(Validator.class('Hello There')).toBe(error);
      expect(Validator.class('fdsafdsaf\\')).toBe(error);
      expect(Validator.class('_$(#*$)#@')).toBe(error);
    });
  });

  describe('#className', function () {
    const error = 'Invalid PHP class name: only alphanumerical characters allowed.';
    it('Accepts valid', function () {
      expect(Validator.className('Hello')).toBe(true);
      expect(Validator.className('world')).toBe(true);
    });

    it('Rejects classes', function () {
      expect(Validator.className('Hello\\There')).toBe(error);
      expect(Validator.className('Hello\\There\\This\\Could\\Go\\On\\Forever')).toBe(error);
    });

    it('Rejects qualified', function () {
      expect(Validator.className('\\Hello')).toBe(error);
      expect(Validator.className('\\Hello\\There')).toBe(error);
      expect(Validator.className('\\Hello\\There\\This\\Could\\Go\\On\\Forever')).toBe(error);
    });
  });
});
