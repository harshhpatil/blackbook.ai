import express from "express";
import multer from "multer";
import path from "path";

import { extractPlaceholders } from "../services/template.js";
import { analyzeProjectImage } from "../services/gemini.js"; 
import { downloadRemoteAsset } from "../services/remoteAsset.js";
import { createEngineKey, putObject } from "../services/storage.js";

const router = express.Router();

const templateUpload = multer({ storage: multer.memoryStorage() });
const rawUpload = multer({ storage: multer.memoryStorage() });
const imageStorage = multer.memoryStorage();

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const imageUpload = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

async function sourceFile(req, fallbackMime) {
  if (req.file) {
    return {
      buffer: req.file.buffer,
      filename: path.basename(req.file.originalname),
      contentType: req.file.mimetype || fallbackMime,
    };
  }
  const remote = await downloadRemoteAsset(req.body);
  return {
    buffer: remote.buffer,
    filename: remote.filename,
    contentType: req.body?.contentType || fallbackMime,
  };
}

// POST /api/template — upload ANY DOCX template. The engine reads whatever
// {{field}} placeholders it actually contains, no fixed schema assumed.
router.post("/template", express.json(), templateUpload.single("template"), async (req, res) => {
  if (!req.file && !req.body?.url) {
    return res.status(400).json({ success: false, error: "No template file or URL supplied" });
  }

  try {
    const source = await sourceFile(
      req,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const fields = await extractPlaceholders(source.buffer);
    const key = createEngineKey("templates", source.filename);
    await putObject(key, source.buffer, source.contentType);
    return res.json({
      success: true,
      message: fields.length
        ? `Template uploaded — found ${fields.length} fields`
        : "Template uploaded — no placeholders detected",
      filename: source.filename,
      objectKey: key,
      fields,
    });
  } catch (err) {
    console.warn("Couldn't pre-scan template for placeholders:", err.message);
    return res.status(502).json({
      success: false,
      error: "Unable to download or inspect template",
      detail: err.message,
    });
  }
});

// POST /api/raw — upload raw project data (pdf/docx/txt)
router.post("/raw", express.json(), rawUpload.single("raw"), async (req, res) => {
  if (!req.file && !req.body?.url) {
    return res.status(400).json({ success: false, error: "No raw file or URL supplied" });
  }

  try {
    const source = await sourceFile(req, "application/octet-stream");
    const key = createEngineKey("uploads", source.filename);
    await putObject(key, source.buffer, source.contentType);
    return res.json({
      success: true,
      message: "Raw data uploaded",
      filename: source.filename,
      objectKey: key,
    });
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: "Unable to download raw asset",
      detail: err.message,
    });
  }
});

// POST /api/analyze-image — upload a project output image, get a Gemini-generated summary
router.post("/analyze-image", imageUpload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: "No image file uploaded" });

  const imageName = (req.body.imageName || req.file.originalname || "Project Output").trim();

  try {
    const imageBuffer = req.file.buffer;
    const summary = await analyzeProjectImage(imageBuffer, req.file.mimetype, imageName);
    res.json({
      success: true,
      message: "Image analyzed",
      filename: req.file.originalname,
      imageName,
      summary,
    });
  } catch (err) {
    console.error("Image analysis failed:", err);
    res.status(502).json({
      success: false,
      error: "Image analysis failed",
      detail: err.message,
      filename: req.file.originalname,
      imageName,
      summary: null,
    });
  }
});

export default router;
