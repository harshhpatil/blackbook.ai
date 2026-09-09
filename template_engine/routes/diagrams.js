import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { extractText } from "../services/extractText.js";
import {
  generateProjectDiagrams,
  refineSingleDiagram,
  renderMermaidToPng,
} from "../services/diagrams.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "uploads");

const router = express.Router();

// POST /api/diagrams/generate
router.post("/diagrams/generate", async (req, res) => {
  const { rawFilename, rawText: inlineRawText } = req.body;

  try {
    let rawText = inlineRawText || "";
    if (!rawText && rawFilename) {
      const rawPath = path.join(uploadsDir, rawFilename);
      rawText = await extractText(rawPath);
    }

    if (!rawText || rawText.trim().length === 0) {
      return res.status(400).json({ error: "Please provide project notes or upload a file" });
    }

    const diagrams = await generateProjectDiagrams(rawText);

    res.json({
      message: "Diagrams generated successfully 🔥",
      diagrams,
    });
  } catch (err) {
    console.error("Diagram generation failed:", err);
    res.status(500).json({
      error: "Diagram generation failed",
      detail: err.message || String(err),
    });
  }
});

// POST /api/diagrams/refine
router.post("/diagrams/refine", async (req, res) => {
  const { currentMermaid, instruction, rawText } = req.body;

  if (!currentMermaid || !instruction) {
    return res.status(400).json({ error: "Missing currentMermaid or instruction" });
  }

  try {
    const refined = await refineSingleDiagram(currentMermaid, instruction, rawText);
    res.json({
      message: "Diagram refined successfully ✨",
      ...refined,
    });
  } catch (err) {
    console.error("Diagram refinement failed:", err);
    res.status(500).json({
      error: "Diagram refinement failed",
      detail: err.message || String(err),
    });
  }
});

export default router;
