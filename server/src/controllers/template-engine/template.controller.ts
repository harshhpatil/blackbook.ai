import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import mammoth from "mammoth";

// Reads ANY .docx template and returns the list of {{field}} placeholder names
// it actually contains — the engine no longer assumes a fixed schema.
// Uses mammoth (not raw XML regex) because Word frequently splits text across
// multiple XML runs (autocorrect, spellcheck), and mammoth's document model
// merges those runs back into clean plain text before we scan for tags.
export async function extractPlaceholders(templatePath: string) {
  const { value: text } = await mammoth.extractRawText({ path: templatePath });
  const matches = [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)];
  const fieldNames = [...new Set(matches.map((m) => m[1]))];
  return fieldNames;
}

export function fillTemplate(
  templatePath: string,
  data: Record<string, string>,
  outputPath: string
) {
  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    // If Gemini couldn't find a value for some field, render an empty string
    // instead of crashing the whole generation — partial output beats none.
    nullGetter: () => "",
  });

  try {
    doc.render(data);
  } catch (err) {
    throw new Error(`Failed to render template: ${(err as Error).message}`);
  }

  const buf = doc.getZip().generate({ type: "nodebuffer" });
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(outputPath, buf);
  return outputPath;
}
