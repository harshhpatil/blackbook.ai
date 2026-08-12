import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import * as pdfParse from 'pdf-parse';


/**
 * @function extractText
 * @description Extracts raw text from PDF, DOCX, or TXT files.
 * Uses async file reads to prevent blocking the Node.js event loop.
 * 
 * @param {string} filePath - The absolute local path to the temporary file.
 * @returns {Promise<string>} The extracted raw text.
 * @throws {Error} If the file type is unsupported.
 */
export async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    // Non-blocking read
    const buffer = await fs.readFile(filePath);
    
    // Correct standard pdf-parse syntax
    const data = await (pdfParse as unknown).default(buffer);
    return data.text;
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (ext === '.txt') {
    // Non-blocking read
    return fs.readFile(filePath, 'utf-8');
  }

  throw new Error(`Unsupported file type: ${ext}`);
}