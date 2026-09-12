import express from "express";

import { extractText } from "../services/extractText.js";
import { extractStructuredData } from "../services/gemini.js";
import { extractPlaceholders, fillTemplate } from "../services/template.js";
import { convertToPdf } from "../services/pdf.js";
import { generateProjectDiagrams, renderMermaidToPng } from "../services/diagrams.js";
import { downloadRemoteAsset } from "../services/remoteAsset.js";
import { createEngineKey, putObject, getSignedUrl } from "../services/storage.js";

const router = express.Router();

// POST /api/generate — Stateless generation using memory buffers and Cloudflare R2
router.post("/generate", async (req, res) => {
  const { template, raw, rawText: inlineRawText } = req.body;

  if (!template || (!raw && !inlineRawText)) {
    return res.status(400).json({
      error: "Need both templateFilename and project data (file upload or raw text) to generate.",
    });
  }

  try {
    const templateAsset = await downloadRemoteAsset(template);
    // 1. Identify what fields the template needs
    const fieldNames = await extractPlaceholders(templateAsset.buffer);
    if (fieldNames.length === 0) {
      return res.status(422).json({
        error:
          "No {{placeholders}} found in this template. Either add {{field}} tags " +
          "to your .docx, or use the Train Template tab to auto-generate one from a filled document.",
      });
    }

    // 2. Extract raw text from uploaded file or use inline raw text
    let rawText = inlineRawText || "";
    if (!rawText && raw) {
      const rawAsset = await downloadRemoteAsset(raw);
      rawText = await extractText(rawAsset.buffer, rawAsset.filename);
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
      req.log.error({ err }, "Gemini synthesis failed during report generation");
      return res.status(502).json({
        success: false,
        error: "Gemini synthesis failed — check GEMINI_API_KEY and try again",
        detail: err.message,
      });
    }

    // 4. Fill the DOCX template with structured text AND embed all diagrams directly
    const stamp = Date.now();
    const docxFilename = `report-${stamp}.docx`;
    const docxBuffer = fillTemplate(templateAsset.buffer, structuredData, renderedDiagramsMap);
    const docxKey = createEngineKey("outputs", docxFilename);
    await putObject(docxKey, docxBuffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const docxUrl = await getSignedUrl(docxKey);

    // 5. Convert to PDF if LibreOffice is available
    let pdfUrl = null;
    let pdfKey = null;
    let pdfSize = null;
    try {
      const pdfBuffer = await convertToPdf(docxBuffer);
      const pdfFilename = `report-${stamp}.pdf`;
      pdfKey = createEngineKey("outputs", pdfFilename);
      pdfSize = pdfBuffer.length;
      await putObject(pdfKey, pdfBuffer, "application/pdf");
      pdfUrl = await getSignedUrl(pdfKey);
    } catch (err) {
      console.warn("PDF conversion note:", err.message);
    }

    res.json({
      success: true,
      message: "Academic Black Book & Diagrams Generated Successfully 🔥",
      detectedFields: fieldNames,
      data: structuredData,
      diagrams,
      docxUrl,
      pdfUrl,
      docxKey,
      pdfKey,
      docxSize: docxBuffer.length,
      pdfSize,
    });
  } catch (err) {
    console.error("Generation failed:", err);
    res.status(500).json({
      success: false,
      error: "Generation failed",
      detail: err.message || String(err),
    });
  }
});

export default router;
