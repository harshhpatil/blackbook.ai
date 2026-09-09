import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { extractText } from "../services/extractText.js";
import { extractStructuredData } from "../services/gemini.js";
import { extractPlaceholders, fillTemplate } from "../services/template.js";
import { convertToPdf } from "../services/pdf.js";
import { generateProjectDiagrams, renderMermaidToPng } from "../services/diagrams.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const templatesDir = path.join(__dirname, "..", "templates");
const uploadsDir = path.join(__dirname, "..", "uploads");
const outputsDir = path.join(__dirname, "..", "outputs");

// POST /api/generate — fills the template with extracted data AND embeds technical diagrams directly into the report
router.post("/generate", async (req, res) => {
  const { templateFilename, rawFilename, rawText: inlineRawText } = req.body;

  if (!templateFilename || (!rawFilename && !inlineRawText)) {
    return res.status(400).json({
      error: "Need both templateFilename and project data (file upload or raw text) to generate.",
    });
  }

  const templatePath = path.join(templatesDir, templateFilename);

  try {
    // 1. Identify what fields the template needs
    const fieldNames = await extractPlaceholders(templatePath);
    if (fieldNames.length === 0) {
      return res.status(422).json({
        error:
          "No {{placeholders}} found in this template. Either add {{field}} tags " +
          "to your .docx, or use the Train Template tab to auto-generate one from a filled document.",
      });
    }

    // 2. Extract raw text from uploaded file or use inline raw text
    let rawText = inlineRawText || "";
    if (!rawText && rawFilename) {
      const rawPath = path.join(uploadsDir, rawFilename);
      rawText = await extractText(rawPath);
    }

    if (!rawText || rawText.trim().length === 0) {
      return res.status(422).json({ error: "Couldn't extract any text from the project data provided" });
    }

    const includeDiagrams = req.body.includeDiagrams !== false;

    // 3. Synthesize structured text and technical diagrams in parallel
    let structuredData;
    let diagrams = {};
    let renderedDiagramsMap = {};

    try {
      if (includeDiagrams) {
        const [dataRes, diagRes] = await Promise.allSettled([
          extractStructuredData(rawText, fieldNames),
          generateProjectDiagrams(rawText),
        ]);

        if (dataRes.status === "fulfilled") {
          structuredData = dataRes.value;
        } else {
          throw dataRes.reason;
        }

        if (diagRes.status === "fulfilled" && diagRes.value) {
          diagrams = diagRes.value;

          // Render each diagram to PNG buffer in parallel for direct DOCX embedding
          const renderPromises = Object.entries(diagrams).map(async ([key, diag]) => {
            try {
              const pngBuf = await renderMermaidToPng(diag.mermaid, diag.title);
              renderedDiagramsMap[key] = {
                ...diag,
                buffer: pngBuf,
              };
            } catch (renderErr) {
              console.warn(`Could not render PNG for ${key}:`, renderErr.message);
            }
          });
          await Promise.allSettled(renderPromises);
        }
      } else {
        structuredData = await extractStructuredData(rawText, fieldNames);
      }
    } catch (err) {
      return res.status(502).json({
        error: "Gemini synthesis failed — check GEMINI_API_KEY and try again",
        detail: err.message,
      });
    }

    // 4. Fill the DOCX template with structured text AND embed all diagrams directly
    const stamp = Date.now();
    const docxFilename = `report-${stamp}.docx`;
    const docxPath = fillTemplate(templatePath, structuredData, renderedDiagramsMap, docxFilename);

    // 5. Convert to PDF if LibreOffice is available
    let pdfFilename = null;
    try {
      const pdfPath = path.join(outputsDir, `report-${stamp}.pdf`);
      await convertToPdf(docxPath, pdfPath);
      pdfFilename = path.basename(pdfPath);
    } catch (err) {
      console.warn("PDF conversion note:", err.message);
    }

    res.json({
      message: "Academic Black Book & Diagrams Generated Successfully 🔥",
      detectedFields: fieldNames,
      data: structuredData,
      diagrams,
      docx: `/outputs/${docxFilename}`,
      pdf: pdfFilename ? `/outputs/${pdfFilename}` : null,
    });
  } catch (err) {
    console.error("Generation failed:", err);
    res.status(500).json({
      error: "Generation failed",
      detail: err.message || String(err),
    });
  }
});

export default router;
