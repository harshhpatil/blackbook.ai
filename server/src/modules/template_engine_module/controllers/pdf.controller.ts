import fs from 'node:fs/promises';
import { promisify } from 'node:util';
import libre from 'libreoffice-convert';

const convertAsync = promisify(libre.convert);

/**
 * @function convertToPdf
 * @description Converts a generated DOCX file into a PDF using the system's LibreOffice installation.
 * Uses non-blocking async file operations to keep the Node.js event loop highly responsive
 * during heavy I/O tasks.
 *
 * @param {string} docxPath - The absolute path to the source DOCX file.
 * @param {string} pdfOutputPath - The absolute path where the PDF should be saved.
 * @returns {Promise<string>} The path to the generated PDF.
 * @throws {Error} If LibreOffice is not installed on the server or the conversion fails.
 */
export async function convertToPdf(
  docxPath: string,
  pdfOutputPath: string
): Promise<string> {
  // Non-blocking file read
  const docxBuf = await fs.readFile(docxPath);

  // Execute the PDF conversion asynchronously via the LibreOffice CLI wrapper
  const pdfBuf = await convertAsync(docxBuf, '.pdf', undefined);

  // Non-blocking file write
  await fs.writeFile(pdfOutputPath, pdfBuf);

  return pdfOutputPath;
}
