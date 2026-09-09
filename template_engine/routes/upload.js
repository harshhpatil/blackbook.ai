import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { extractPlaceholders } from "../services/template.js";
import { analyzeProjectImage } from "../services/gemini.js"; 

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Ensure dirs exist
const templatesDir = path.join(__dirname, "..", "templates");
const uploadsDir = path.join(__dirname, "..", "uploads");
const projectImagesDir = path.join(__dirname, "..", "uploads", "project-images");
[templatesDir, uploadsDir, projectImagesDir].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const templateStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, templatesDir),
  filename: (req, file, cb) => cb(null, `template-${Date.now()}${path.extname(file.originalname)}`),
});

const rawStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `raw-${Date.now()}${path.extname(file.originalname)}`),
});

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, projectImagesDir),
  filename: (req, file, cb) => cb(null, `img-${Date.now()}${path.extname(file.originalname)}`),
});

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const imageUpload = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const templateUpload = multer({ storage: templateStorage });
const rawUpload = multer({ storage: rawStorage });

// POST /api/template — upload ANY DOCX template. The engine reads whatever
// {{field}} placeholders it actually contains, no fixed schema assumed.
router.post("/template", templateUpload.single("template"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No template file uploaded, bro" });

  let fields = [];
  try {
    fields = await extractPlaceholders(path.join(templatesDir, req.file.filename));
  } catch (err) {
    console.warn("Couldn't pre-scan template for placeholders:", err.message);
  }

  res.json({
    message: fields.length
      ? `Template uploaded — found ${fields.length} field${fields.length === 1 ? "" : "s"}`
      : "Template uploaded — no {{placeholders}} detected, Generate will fail until you add some",
    filename: req.file.filename,
    path: `/templates/${req.file.filename}`,
    fields,
  });
});

// POST /api/raw — upload raw project data (pdf/docx/txt)
router.post("/raw", rawUpload.single("raw"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No raw data file uploaded" });
  res.json({
    message: "Raw data uploaded",
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`,
  });
});

// POST /api/analyze-image — upload a project output image, get a Gemini-generated summary
router.post("/analyze-image", imageUpload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file uploaded" });

  const imageName = (req.body.imageName || req.file.originalname || "Project Output").trim();
  const imagePath = req.file.path;
  const servePath = `/uploads/project-images/${req.file.filename}`;

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const summary = await analyzeProjectImage(imageBuffer, req.file.mimetype, imageName);
    res.json({
      message: "Image analyzed",
      filename: req.file.filename,
      path: servePath,
      imageName,
      summary,
    });
  } catch (err) {
    console.error("Image analysis failed:", err);
    res.status(502).json({
      error: "Image analysis failed",
      detail: err.message,
      // Still return path so the image isn't lost
      filename: req.file.filename,
      path: servePath,
      imageName,
      summary: null,
    });
  }
});

export default router;
