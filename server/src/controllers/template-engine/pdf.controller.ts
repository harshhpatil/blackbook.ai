import libre from 'libreoffice-convert';
import fs from 'fs';
import { promisify } from 'util';

const convertAsync = promisify(libre.convert);

export async function convertToPdf(docxPath: string, pdfOutputPath: string) {
  const docxBuf = fs.readFileSync(docxPath);
  const pdfBuf = await convertAsync(docxBuf, '.pdf', undefined);
  fs.writeFileSync(pdfOutputPath, pdfBuf);
  return pdfOutputPath;
}
