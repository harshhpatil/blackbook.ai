import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { extractText } from "../services/extractText.js";
import { suggestFieldMappings, applyTemplateMapping } from "../services/trainer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const uploadsDir = path.join(__dirname, "..", "uploads");
const templatesDir = path.join(__dirname, "..", "templates");
[uploadsDir, templatesDir].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `trainer-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

// POST /api/train/analyze — upload last year's FILLED black book,
// get back suggested {field: {value, confidence}} mappings to review
router.post("/train/analyze", upload.single("filledDoc"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No filled document uploaded" });

  try {
    const rawText = await extractText(path.join(uploadsDir, req.file.filename));
    const suggestions = await suggestFieldMappings(rawText);

    res.json({
      message: "Analysis complete — review and approve before applying",
      filename: req.file.filename,
      suggestions,
    });
  } catch (err) {
    res.status(502).json({ error: "Template analysis failed", detail: err.message });
  }
});

// POST /api/train/confirm — body: { filename, approvedMapping: { field: value, ... }, templateName? }
// Swaps approved values for {{field}} placeholders and saves a reusable template
router.post("/train/confirm", express.json(), (req, res) => {
  const { filename, approvedMapping, templateName } = req.body;

  if (!filename || !approvedMapping || Object.keys(approvedMapping).length === 0) {
    return res.status(400).json({ error: "Need filename and at least one approved field mapping" });
  }

  const sourcePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(sourcePath)) {
    return res.status(404).json({ error: "Source file not found — re-upload and re-analyze" });
  }

  const outName = templateName
    ? `${templateName.replace(/[^a-z0-9-_]/gi, "_")}.docx`
    : `trained-template-${Date.now()}.docx`;
  const outputPath = path.join(templatesDir, outName);

  try {
    const result = applyTemplateMapping(sourcePath, approvedMapping, outputPath);
    res.json({
      message: "Template trained and saved 🔥",
      templatePath: `/templates/${outName}`,
      appliedFields: result.applied,
      skippedFields: result.skipped, // didn't find an exact literal match — needs manual fix
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to apply template mapping", detail: err.message });
  }
});

export default router;
