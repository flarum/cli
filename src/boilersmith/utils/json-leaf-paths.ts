type JSONSchema = string | number | boolean | JSONSchemaObject | JSONSchemaArray | null;

interface JSONSchemaObject {
  [key: string]: JSONSchema;
}

type JSONSchemaArray = Array<JSONSchema>;

function inner(o: JSONSchema, prefix: string[]): string[] {
  if (Array.isArray(o)) {
    // Placed separately in case we eventually decide to support leaves in arrays.
    return [prefix.join('.')];
  }

  if (o && typeof o === 'object') {
    return Object.entries(o).flatMap(([k, v]) => inner(v, [...prefix, k]));
  }

  return [prefix.join('.')];
}

export function jsonLeafPaths(obj: JSONSchema): string[] {
  return inner(obj, []);
}
