import { parseModelJson } from './modelJson.ts';
import { assertGeminiInputSize, generateGeminiJson, GeminiGenerationError } from '../../services/gemini.service.ts';

function buildPrompt(rawText: string, fieldNames: string[]): string {
  const fieldList = fieldNames.join(', ');
  return `You are a document parser preparing data to fill in a template.

    Extract values for EXACTLY these fields from the document text below: ${fieldList}

    Use each field's name as a guide to what content belongs in it. For example a field
    named "student_name" should contain a person's name, a field named "ch1_1_background"
    should contain content matching section 1.1 / background-type content, a field named
    "abstract" should contain the document's abstract, and so on — infer intent from naming
    conventions like chapter/section numbers, underscores, and common report terminology.

    Rules:
    - Return valid JSON only, no markdown fences, no commentary — just the JSON object.
    - The JSON must have EXACTLY these keys: ${fieldList}
    - If a field's content can't be found anywhere in the document, return an empty string
    for that field rather than guessing or inventing content.
    - For long-form fields (paragraphs, chapter sections), preserve the original wording
    and paragraph structure rather than summarizing, unless the field name itself implies
    a summary (e.g. a field literally named "summary" or "short_abstract").
    - Do not include any figures, image descriptions, or diagram captions in extracted text.

DOCUMENT TEXT:
${rawText}`;
}

export async function extractStructuredData(
  rawText: string,
  fieldNames: string[]
): Promise<Record<string, string>> {
  if (!fieldNames || fieldNames.length === 0) {
    throw new Error('No fields provided — template has no {{placeholders}}');
  }
  if (fieldNames.length > 200) {
    throw new GeminiGenerationError('Template has too many fields for reliable AI extraction', false, 422);
  }
  assertGeminiInputSize(rawText);

  const schema = {
    type: 'object',
    properties: Object.fromEntries(fieldNames.map((field) => [field, { type: 'string' }])),
    required: fieldNames,
    additionalProperties: false,
  };
  const responseText = await generateGeminiJson({
    operation: 'extract',
    prompt: buildPrompt(rawText, fieldNames),
    responseJsonSchema: schema,
    validateResponse: (text) => {
      try {
        parseModelJson<Record<string, unknown>>(text);
      } catch (error) {
        throw new GeminiGenerationError('Gemini returned invalid structured data', true, 502, { cause: error });
      }
    },
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseModelJson<Record<string, unknown>>(responseText);
  } catch (error) {
    throw new GeminiGenerationError('Gemini returned invalid structured data', false, 502, { cause: error });
  }

  // Strictly type the output mapping object
  const filtered: Record<string, string> = {};
  for (const field of fieldNames) {
    const value = parsed[field];
    filtered[field] = typeof value === 'string' ? value : '';
  }
  
  return filtered;
}
