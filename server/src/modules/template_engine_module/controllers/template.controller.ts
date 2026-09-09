import fs from 'node:fs/promises';
import path from 'node:path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import mammoth from 'mammoth';
import { docmorphClient } from '../services/docmorphClient.service.ts';

export function uploadTemplateToDocMorph(file: Express.Multer.File) {
  return docmorphClient.uploadTemplate(file);
}

/**
 * @function extractPlaceholders
 * @description Reads ANY .docx template and returns the list of {{field}} placeholder names it contains.
 * Uses mammoth instead of raw XML regex because Word frequently splits text across
 * multiple XML runs (autocorrect, spellcheck). Mammoth merges them back into clean text.
 *
 * @param {string} templatePath - The absolute path to the DOCX template.
 * @returns {Promise<string[]>} Array of unique placeholder names found in the template.
 */
export async function extractPlaceholders(
  templatePath: string
): Promise<string[]> {
  const { value: text } = await mammoth.extractRawText({ path: templatePath });
  const matches = [...text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)];

  // Deduplicate the extracted field names
  const fieldNames = [...new Set(matches.map((m) => m[1]))];
  return fieldNames;
}

/**
 * @function fillTemplate
 * @description Injects the AI-extracted data into the DOCX template and saves the compiled file.
 * Safely handles missing fields by inserting empty strings instead of crashing.
 *
 * @param {string} templatePath - The absolute path to the source DOCX template.
 * @param {Record<string, string>} data - The structured data mapped to placeholder keys.
 * @param {string} outputPath - The absolute path where the compiled DOCX should be saved.
 * @returns {Promise<string>} The output path of the compiled document.
 * @throws {Error} If Docxtemplater fails to render the template.
 */
export async function fillTemplate(
  templatePath: string,
  data: Record<string, string>,
  outputPath: string
): Promise<string> {
  // Non-blocking read prevents server freezing
  const content = await fs.readFile(templatePath, 'binary');
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    // If Gemini couldn't find a value for some field, render an empty string
    // instead of crashing the whole generation — partial output beats none.
    nullGetter: () => '',
  });

  try {
    doc.render(data);
  } catch (err) {
    throw new Error(`Failed to render template:`, { cause: err });
  }

  const buf = doc.getZip().generate({ type: 'nodebuffer' });
  const outputDir = path.dirname(outputPath);

  // Non-blocking directory creation and write
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, buf);

  return outputPath;
}
