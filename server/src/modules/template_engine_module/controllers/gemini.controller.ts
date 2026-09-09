import { parseModelJson } from '../modelJson.ts';
import {
  assertGeminiInputSize,
  generateGeminiJson,
  GeminiGenerationError,
} from '../services/gemini.service.ts';
import { docmorphClient } from '../services/docmorphClient.service.ts';

export function generateReportWithDocMorph(body: {
  templateFilename: string;
  rawFilename?: string;
  rawText?: string;
  includeDiagrams?: boolean;
}) {
  return docmorphClient.generateReport(body);
}

export function analyzeImageWithDocMorph(file: Express.Multer.File, imageName?: string) {
  return docmorphClient.analyzeImage(file, imageName);
}

export function generateDiagramsWithDocMorph(body: { rawFilename?: string; rawText?: string }) {
  return docmorphClient.generateDiagrams(body);
}

export function refineDiagramWithDocMorph(body: {
  currentMermaid: string;
  instruction: string;
  rawText?: string;
}) {
  return docmorphClient.refineDiagram(body);
}

/**
 * @function buildPrompt
 * @description Constructs a strict, rule-bound prompt for the Gemini model to extract
 * specific template placeholders from raw text.
 *
 * @param {string} rawText - The extracted text from the source document.
 * @param {string[]} fieldNames - An array of placeholder names found in the template.
 * @returns {string} The fully constructed prompt.
 */
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

/**
 * @function extractStructuredData
 * @description Orchestrates the AI extraction process. Validates constraints, builds the JSON schema,
 * queries Gemini, and ensures the returned data strictly maps to the requested template fields.
 *
 * @param {string} rawText - The source text to analyze.
 * @param {string[]} fieldNames - The exact template keys that need values.
 * @returns {Promise<Record<string, string>>} A strictly typed map of field names to extracted content.
 * @throws {Error | GeminiGenerationError} If validation fails or the AI response is malformed.
 */
export async function extractStructuredData(
  rawText: string,
  fieldNames: string[]
): Promise<Record<string, string>> {
  if (!fieldNames || fieldNames.length === 0) {
    throw new Error('No fields provided — template has no {{placeholders}}');
  }

  if (fieldNames.length > 200) {
    throw new GeminiGenerationError(
      'Template has too many fields for reliable AI extraction',
      false,
      422
    );
  }

  assertGeminiInputSize(rawText);

  // Force Gemini to strictly adhere to the shape of the placeholders
  const schema = {
    type: 'object',
    properties: Object.fromEntries(
      fieldNames.map((field) => [field, { type: 'string' }])
    ),
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
        throw new GeminiGenerationError(
          'Gemini returned invalid structured data',
          true,
          502,
          { cause: error }
        );
      }
    },
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseModelJson<Record<string, unknown>>(responseText);
  } catch (error) {
    throw new GeminiGenerationError(
      'Gemini returned invalid structured data',
      false,
      502,
      { cause: error }
    );
  }

  // Strictly type the output mapping object, guaranteeing no unexpected types
  const filtered: Record<string, string> = {};
  for (const field of fieldNames) {
    const value = parsed[field];
    filtered[field] = typeof value === 'string' ? value : '';
  }

  return filtered;
}
