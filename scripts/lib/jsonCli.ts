type JsonRecord = Record<string, unknown>;

function describeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
}

export async function readJsonFromStdin(): Promise<unknown> {
  const chunks: string[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
  }

  const rawInput = chunks.join('').trim();
  if (!rawInput) {
    throw new Error('Input JSON is required');
  }

  try {
    return JSON.parse(rawInput) as unknown;
  } catch {
    throw new Error('Input must be valid JSON');
  }
}

export function writeJson(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export function writeErrorJson(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  writeJson({ error: message });
}

export function expectRecord(value: unknown, context: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`"${context}" must be an object (received ${describeValue(value)})`);
  }

  return value;
}

export function readBoolean(record: JsonRecord, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new Error(`"${key}" must be a boolean`);
  }

  return value;
}

export function readNumber(record: JsonRecord, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`"${key}" must be a finite number`);
  }

  return value;
}

export function readString(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`"${key}" must be a string`);
  }

  return value;
}
