export function generateId(): string {
  return crypto.randomUUID();
}

export function validateJsonSchema(data: any, schema: any): boolean {
  // Simple JSON Schema validation
  // In production, use a library like ajv
  if (schema.type === 'object') {
    if (typeof data !== 'object' || data === null) return false;

    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) return false;
      }
    }

    return true;
  }

  return true;
}
