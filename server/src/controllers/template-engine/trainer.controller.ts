import fs from 'node:fs';
import PizZip from 'pizzip';

import { parseModelJson } from './modelJson.ts';
import { assertGeminiInputSize, generateGeminiJson, GeminiGenerationError } from '../../services/gemini.service.ts';

const TRAINER_PROMPT = `You are analyzing a FILLED document to turn it into a reusable
template. This could be an academic report, a black book, a letter, an invoice, a
certificate — anything. Don't assume any fixed structure; look at the document's own
headings, chapters, sections, and recurring patterns (names, dates, titles, signatures)
to figure out what the genuinely variable/fillable parts are.

For each variable field you identify:
- Invent a short, descriptive snake_case field name based on its heading or content
  (e.g. "student_name", "ch1_1_background", "abstract", "guide_name", "college").
  Use chapter/section numbers in the field name where the document has them, so the
  field order roughly tracks the document order.
- The "value" MUST be copied character-for-character (verbatim) from the document text
  below, so it can be found again with a literal string match. Do not paraphrase or
  reformat it.
- Give a confidence score from 0 to 1 for how sure you are this is genuinely a
  variable/fillable field (vs. static boilerplate that should stay the same every time).
- Skip purely structural boilerplate (e.g. "Index", "Table of Contents" labels, page
  numbers) — only extract fields whose VALUE would actually change for a different
  person/project/submission.
- Do not extract anything describing or referencing figures, diagrams, or images.

Return valid JSON only, no markdown fences, no commentary, in this exact shape:
{
  "field_name": { "value": "exact text from document", "confidence": 0.93 },
  ...
}`;

export async function suggestFieldMappings(rawText: string) {
  assertGeminiInputSize(rawText);
  const responseText = await generateGeminiJson({
    operation: 'train',
    prompt: `${TRAINER_PROMPT}\n\nDOCUMENT TEXT:\n${rawText}`,
    responseJsonSchema: { type: 'object', additionalProperties: { type: 'object' } },
    validateResponse: (text) => {
      try {
        parseModelJson(text);
      } catch (error) {
        throw new GeminiGenerationError('Gemini returned invalid template-training data', true, 502, { cause: error });
      }
    },
  });
  let suggestions: Record<string, { value?: unknown; confidence?: unknown }>;
  try {
    suggestions = parseModelJson(responseText);
  } catch (error) {
    throw new GeminiGenerationError('Gemini returned invalid template-training data', false, 502, { cause: error });
  }

  const cleaned: Record<string, { value: string; confidence: number }> = {};
  for (const [field, info] of Object.entries(suggestions)) {
    if (!info || typeof info !== 'object') continue;
    if (typeof info.value !== 'string' || !info.value || !rawText.includes(info.value)) continue;

    const confidence = typeof info.confidence === 'number' ? info.confidence : 0;
    cleaned[field] = { value: info.value, confidence };
  }

  return cleaned;
}

export function applyTemplateMapping(
  filledDocxPath: string,
  approvedMapping: Record<string, string>,
  outputFilename: string
) {
  if (!approvedMapping || typeof approvedMapping !== 'object' || Array.isArray(approvedMapping)) {
    throw new Error('approvedMapping must be a plain object of { field: value } pairs');
  }

  const content = fs.readFileSync(filledDocxPath, 'binary');
  const zip = new PizZip(content);

  const docXmlPath = 'word/document.xml';
  let xml = zip.file(docXmlPath)?.asText();

  if (!xml) {
    throw new Error('word/document.xml is missing from the DOCX file');
  }

  const applied: string[] = [];
  const skipped: string[] = [];

  const entries = Object.entries(approvedMapping).sort(
    (a, b) => String(b[1] ?? '').length - String(a[1] ?? '').length
  );

  for (const [field, value] of entries) {
    if (typeof value !== 'string' || !value) {
      skipped.push(field);
      continue;
    }

    const replacement = `{{${field}}}`;
    const escapedValue = escapeXml(value);
    if (xml.includes(escapedValue)) {
      xml = xml.split(escapedValue).join(replacement);
      applied.push(field);
      continue;
    }

    const fallback = replaceTextAcrossRuns(xml, value, replacement);
    xml = fallback.xml;
    if (fallback.replaced) {
      applied.push(field);
    } else {
      skipped.push(field);
    }
  }

  zip.file(docXmlPath, xml);
  const buf = zip.generate({ type: 'nodebuffer' });

  fs.writeFileSync(outputFilename, buf);
  return { outputPath: outputFilename, applied, skipped };
}

function escapeXml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function replaceTextAcrossRuns(xml: string, value: string, replacement: string) {
  const nodeRegex = /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/g;
  const nodes: Array<{ start: number; end: number; text: string }> = [];
  let visibleText = '';

  let match: RegExpExecArray | null;
  while ((match = nodeRegex.exec(xml)) !== null) {
    const decoded = decodeXml(match[2]);
    nodes.push({ start: visibleText.length, end: visibleText.length + decoded.length, text: decoded });
    visibleText += decoded;
  }

  const index = visibleText.indexOf(value);
  if (index === -1) {
    return { xml, replaced: false };
  }

  const end = index + value.length;
  let inserted = false;
  const updatedNodes = nodes.map((node) => {
    const overlapStart = Math.max(index, node.start);
    const overlapEnd = Math.min(end, node.end);
    if (overlapStart >= overlapEnd) return node.text;

    const localStart = overlapStart - node.start;
    const localEnd = overlapEnd - node.start;
    const before = node.text.slice(0, localStart);
    const after = node.text.slice(localEnd);

    if (!inserted) {
      inserted = true;
      return before + replacement + after;
    }

    return before + after;
  });

  nodeRegex.lastIndex = 0;
  let nodeIndex = 0;
  const rebuiltXml = xml.replace(nodeRegex, (full, openTag, _inner, closeTag) => {
    const nextText = updatedNodes[nodeIndex++] ?? '';
    return `${openTag}${encodeXml(nextText)}${closeTag}`;
  });

  return { xml: rebuiltXml, replaced: true };
}

function decodeXml(str: string) {
  return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function encodeXml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
