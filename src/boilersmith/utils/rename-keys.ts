export function renameKeys(obj: Record<string, unknown>, func: (key: string, val: unknown) => string): Record<string, unknown> {
    return Object.keys(obj).reduce((acc, k) => {
        return {...acc, [func(k, obj[k])]: obj[k]}
    }, {});
}