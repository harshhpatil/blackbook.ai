import express from "express";
import multer from "multer";

import { extractText } from "../services/extractText.js";
import { suggestFieldMappings, applyTemplateMapping } from "../services/trainer.js";
import { downloadRemoteAsset } from "../services/remoteAsset.js";
import { createEngineKey, putObject, getSignedUrl } from "../services/storage.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/train/analyze — upload last year's FILLED black book,
// get back suggested {field: {value, confidence}} mappings to review
router.post("/train/analyze", express.json(), upload.single("filledDoc"), async (req, res) => {
  if (!req.file && !req.body?.url) {
    return res.status(400).json({ success: false, error: "No filled document or URL supplied" });
  }

  try {
    let buffer;
    let filename;

    if (req.file) {
      buffer = req.file.buffer;
      filename = req.file.originalname;
    } else {
      const asset = await downloadRemoteAsset(req.body);
      buffer = asset.buffer;
      filename = asset.filename;
    }

    const rawText = await extractText(buffer, filename);
    const suggestions = await suggestFieldMappings(rawText);

    return res.json({
      success: true,
      message: "Analysis complete — review and approve before applying",
      filename,
      suggestions,
    });
  } catch (err) {
    console.error("Template analysis failed:", err);
    res.status(502).json({
      success: false,
      error: "Template analysis failed",
      detail: err.message || String(err),
    });
  }
});

// POST /api/train/confirm — body: { source: { url, filename }, approvedMapping: { field: value, ... }, templateName? }
// Swaps approved values for {{field}} placeholders and saves a reusable template
router.post("/train/confirm", express.json(), async (req, res) => {
  const { source, filename, approvedMapping, templateName } = req.body;

  if ((!source?.url && !filename) || !approvedMapping || Object.keys(approvedMapping).length === 0) {
    return res.status(400).json({
      success: false,
      error: "Need source URL and at least one approved field mapping",
    });
  }

  const outName = templateName
    ? `${templateName.replace(/[^a-z0-9-_]/gi, "_")}.docx`
    : `trained-template-${Date.now()}.docx`;

  try {
    let buffer;
    if (source?.url) {
      const sourceAsset = await downloadRemoteAsset(source);
      buffer = sourceAsset.buffer;
    } else {
      return res.status(400).json({ success: false, error: "A source asset with a valid download URL is required" });
    }

    const result = applyTemplateMapping(buffer, approvedMapping);
    const templateKey = createEngineKey("templates", outName);
    await putObject(
      templateKey,
      result.buffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const templateUrl = await getSignedUrl(templateKey);

    return res.json({
      success: true,
      message: "Template trained and saved 🔥",
      templateKey,
      templateUrl,
      appliedFields: result.applied,
      skippedFields: result.skipped, // didn't find an exact literal match — needs manual fix
    });
  } catch (err) {
    console.error("Failed to apply template mapping:", err);
    res.status(500).json({
      success: false,
      error: "Failed to apply template mapping",
      detail: err.message || String(err),
    });
  }
});

export default router;
