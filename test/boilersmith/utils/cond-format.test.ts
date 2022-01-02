import { condFormat } from 'boilersmith/utils/cond-format';

describe('cond-format', function () {
    it('works when true', function () {
        const result = condFormat(true, () => 'foo', 'bar');
        expect(result).toStrictEqual('foo');
    });

    it('works when false', function () {
        const result = condFormat(false, () => 'foo', 'bar');
        expect(result).toStrictEqual('bar');
    });
});
