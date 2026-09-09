// Phase 5: Template Trainer
// Takes an already-filled document (any structure — black book, letter, invoice,
// whatever) and asks Gemini to look at the document's OWN headings/structure and
// invent appropriate field names + locate their exact text, rather than matching
// against a fixed predefined list. This is what makes the engine work for "any
// type of template" instead of one hardcoded shape.

import fs from "fs";
import PizZip from "pizzip";
import { GoogleGenAI } from "@google/genai";
import { safeJsonParse } from "./safeJson.js";





let _ai = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing. Add it to server/.env and restart.");
  }
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _ai;
}

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const TRAINER_PROMPT = `You are analyzing an academic black book / engineering report to turn it into a reusable template.
Look at the document's own headings, chapters, sections, and technical content to identify the variable, fillable parts.

IMPORTANT SCOPE RULE:
- SKIP front-matter administrative certificate pages completely (such as Student Declaration, Certificate of Approval, Guide Certificate, Principal Signature Sheet, Company NOC, and Acknowledgement signatures).
- Focus STRICTLY from the Index / Table of Contents / Abstract through all technical chapters (Introduction, Literature Survey, System Design, Methodology, Implementation, Testing, Results, Future Scope, Conclusion) and References to the end.

For each variable field you identify:
- Invent a short, descriptive snake_case field name based on its heading or content
  (e.g. "project_title", "student_name", "guide_name", "department", "college", "abstract", "ch1_1_background", "problem_statement", "objectives", "literature_survey", "system_architecture", "methodology", "testing_results", "future_scope", "conclusion", "references").
  Use chapter/section numbers in the field name where the document has them, so the
  field order roughly tracks the document order.
- The "value" MUST be copied character-for-character (verbatim) from the document text
  below, so it can be found again with a literal string match. Do not paraphrase or
  reformat it.
- Give a confidence score from 0 to 1 for how sure you are this is genuinely a
  variable/fillable field (vs. static boilerplate that should stay the same every time).
- Skip purely structural boilerplate (e.g. "Index", "Table of Contents" labels, page numbers).
- Do not extract anything describing or referencing figures, diagrams, or images.

Return valid JSON only, no markdown fences, no commentary, in this exact shape:
{
  "field_name": { "value": "exact text from document", "confidence": 0.93 },
  ...
}`;

// Step 1: ask Gemini to find which spans of text map to which fields,
// letting it determine the fields themselves from the document's structure.
export async function suggestFieldMappings(rawText) {
  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: `${TRAINER_PROMPT}\n\nDOCUMENT TEXT:\n${rawText}`,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const suggestions = safeJsonParse(response.text);

  // Defensive: only keep suggestions whose value literally appears in the
  // source text (protects against hallucinated/paraphrased values)
  const cleaned = {};
  for (const [field, info] of Object.entries(suggestions)) {
    if (!info?.value || !rawText.includes(info.value)) continue;
    cleaned[field] = info;
  }
  return cleaned;
}

// Step 2: once the user approves the suggestions (editing any that are wrong),
// do a literal find-and-replace inside document.xml, swapping each approved
// value for {{field}}, and save the result as a new reusable template.
//
// LIMITATION: this works when a field's text lives inside a single XML run
// (<w:t>...</w:t>), which covers the vast majority of black book exports.
// Values split across multiple runs (e.g. due to inline spellcheck markup)
// won't be caught — those need a manual placeholder swap in Word.
export function applyTemplateMapping(filledDocxPath, approvedMapping, outputFilename) {
  const content = fs.readFileSync(filledDocxPath, "binary");
  const zip = new PizZip(content);

  const docXmlPath = "word/document.xml";
  let xml = zip.file(docXmlPath).asText();

  const applied = [];
  const skipped = [];

  // Replace longer values first so a short value that happens to be a substring
  // of a longer one (e.g. "Mhatre" inside "Pushkar Ravindra Mhatre") doesn't
  // get clobbered before the longer field gets its turn.
  const entries = Object.entries(approvedMapping).sort(
    (a, b) => b[1].length - a[1].length
  );

  for (const [field, value] of entries) {
    const escapedValue = escapeXml(value);
    if (xml.includes(escapedValue)) {
      xml = xml.replace(escapedValue, `{{${field}}}`);
      applied.push(field);
    } else {
      skipped.push(field);
    }
  }

  zip.file(docXmlPath, xml);
  const buf = zip.generate({ type: "nodebuffer" });

  fs.writeFileSync(outputFilename, buf);
  return { outputPath: outputFilename, applied, skipped };
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}