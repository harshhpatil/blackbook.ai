export function normalizeModelJsonText(text: string): string {
  if (typeof text !== 'string') return '';

  const stripped = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');

  if (start !== -1 && end !== -1 && end > start) {
    return stripped.slice(start, end + 1).trim();
  }

  return stripped;
}

export function parseModelJson<T extends Record<string, unknown>>(text: string): T {
  const normalized = normalizeModelJsonText(text);

  if (!normalized) {
    throw new Error('Model response did not contain JSON');
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Model response JSON was not an object');
    }

    return parsed as T;
  } catch {
    throw new Error('Model response was not valid JSON');
  }
}
