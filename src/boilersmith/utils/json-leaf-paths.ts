type JSONSchema = string | number | boolean | JSONSchemaObject | JSONSchemaArray | null;

interface JSONSchemaObject {
  [key: string]: JSONSchema;
}

interface JSONSchemaArray extends Array<JSONSchema> {}

function inner(o: JSONSchema, prefix: string[]): string[] {
  if (o instanceof Array) {
    return [];
  }
  else if (o && typeof o === 'object') {
    return Object.entries(o).map(([k, v]) => inner(v, [...prefix, k])).flat();
  }

  return [prefix.join('.')];
}

export function jsonLeafPaths(obj: JSONSchema): string[] {
  return inner(obj, []);
}
