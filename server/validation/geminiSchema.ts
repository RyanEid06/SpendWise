// The application's response schemas use only these JSON Schema keywords.
// Fail closed on an unsupported keyword rather than silently ignoring it.
export function matchesGeminiSchema(value: unknown, schema: any): boolean {
  if (!schema || typeof schema !== 'object') return false;
  if (Object.keys(schema).some(k => !['type', 'enum', 'required', 'properties', 'additionalProperties', 'items'].includes(k))) return false;
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (!types.includes(type) || type === 'number' && !Number.isFinite(value)) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (type === 'object') {
    const object = value as Record<string, unknown>;
    const properties = schema.properties ?? {};
    if (schema.required?.some((key: string) => !Object.hasOwn(object, key))) return false;
    if (schema.additionalProperties === false && Object.keys(object).some(key => !Object.hasOwn(properties, key))) return false;
    return Object.entries(properties).every(([key, child]) => !Object.hasOwn(object, key) || matchesGeminiSchema(object[key], child));
  }
  if (type === 'array' && schema.items) return (value as unknown[]).every(item => matchesGeminiSchema(item, schema.items));
  return true;
}
