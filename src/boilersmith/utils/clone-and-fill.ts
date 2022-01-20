export function cloneAndFill<T>(obj: T, params: Record<string, string>): T {
  const fill = (val: string, params: Record<string, string>) => {
    return val.replace(/\${(.*)}/gm, (...match): string => {
      return params[match[1]];
    });
  };

  const recursiveCopyAndFill = (obj: any, params: Record<string, string>): any => {
    if (typeof obj === 'string') return fill(obj, params);
    if (Array.isArray(obj)) return obj.map((v) => recursiveCopyAndFill(v, params));
    // eslint-disable-next-line no-new-object
    if (obj !== new Object(obj)) return obj;

    const newObj: any = {};

    for (const key of Object.keys(obj)) {
      const value = obj[key];

      newObj[key] = recursiveCopyAndFill(value, params);
    }

    return newObj;
  };

  return recursiveCopyAndFill(obj, params);
}
