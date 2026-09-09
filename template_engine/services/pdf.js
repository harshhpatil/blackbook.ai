// Phase 4: convert the filled DOCX to PDF (with cached availability check to save CPU)
import libre from "libreoffice-convert";
import fs from "fs";

let _libreAvailable = null; // null = untested, true = available, false = missing

export async function convertToPdf(docxPath, pdfOutputPath) {
  if (_libreAvailable === false) {
    throw new Error("LibreOffice is not installed (skipping PDF conversion)");
  }

  return new Promise((resolve, reject) => {
    try {
      const docxBuf = fs.readFileSync(docxPath);
      libre.convert(docxBuf, ".pdf", undefined, (err, done) => {
        if (err) {
          if (err.message && err.message.includes("soffice")) {
            _libreAvailable = false;
          }
          return reject(err);
        }
        _libreAvailable = true;
        fs.writeFileSync(pdfOutputPath, done);
        resolve(pdfOutputPath);
      });
    } catch (err) {
      reject(err);
    }
  });
}
