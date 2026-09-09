// Phase 3: extract raw text from uploaded PDF/DOCX/TXT
import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (ext === ".txt" || ext === ".md" || ext === ".markdown" || ext === ".json") {
    return fs.readFileSync(filePath, "utf-8");
  }

  throw new Error(`Unsupported file type: ${ext}`);
}
