import path from "path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export async function extractText(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === ".txt" || ext === ".md" || ext === ".markdown" || ext === ".json") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported file type: ${ext}`);
}
