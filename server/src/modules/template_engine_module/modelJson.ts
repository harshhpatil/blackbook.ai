/**
 * @function normalizeModelJsonText
 * @description Cleans up raw LLM text output by stripping markdown code blocks 
 * and isolating the primary JSON object boundaries.
 * 
 * @param {string} text - The raw string response from the AI model.
 * @returns {string} The isolated, clean JSON string.
 */
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

/**
 * @function parseModelJson
 * @description Normalizes and parses raw LLM text into a strongly typed TypeScript object.
 * Throws clean runtime errors if the response is missing or contains invalid JSON.
 * 
 * @template T - The expected shape of the parsed JSON object.
 * @param {string} text - The raw string response from the AI model.
 * @returns {T} The parsed object.
 * @throws {Error} If JSON is missing, not an object, or syntactically invalid.
 */
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