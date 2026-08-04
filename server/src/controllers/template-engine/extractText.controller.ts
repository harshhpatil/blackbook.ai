import fs from 'node:fs';
import path from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

// function to extract text from a file
export async function extractText(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    await parser.destroy();

    return data.text; // returning the extracted text from the PDF file
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });

    return result.value; // returning the extracted text from the DOCX file
  }

  if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  throw new Error(`unsupported file type: ${ext}`);
}
