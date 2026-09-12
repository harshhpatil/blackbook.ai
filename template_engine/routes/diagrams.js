import express from "express";
import { extractText } from "../services/extractText.js";
import { downloadRemoteAsset } from "../services/remoteAsset.js";
import {
  generateProjectDiagrams,
  refineSingleDiagram,
} from "../services/diagrams.js";

const router = express.Router();

// POST /api/diagrams/generate
router.post("/diagrams/generate", async (req, res) => {
  const { raw, rawText: inlineRawText } = req.body;

  try {
    let rawText = inlineRawText || "";
    if (!rawText && raw?.url) {
      const asset = await downloadRemoteAsset(raw);
      rawText = await extractText(asset.buffer, asset.filename);
    }

    if (!rawText || rawText.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Please provide project notes or upload a file" });
    }

    const diagrams = await generateProjectDiagrams(rawText);

    res.json({
      success: true,
      message: "Diagrams generated successfully 🔥",
      diagrams,
    });
  } catch (err) {
    console.error("Diagram generation failed:", err);
    res.status(500).json({
      success: false,
      error: "Diagram generation failed",
      detail: err.message || String(err),
    });
  }
});

// POST /api/diagrams/refine
router.post("/diagrams/refine", async (req, res) => {
  const { currentMermaid, instruction, rawText } = req.body;

  if (!currentMermaid || !instruction) {
    return res.status(400).json({ success: false, error: "Missing currentMermaid or instruction" });
  }

  try {
    const refined = await refineSingleDiagram(currentMermaid, instruction, rawText);
    res.json({
      success: true,
      message: "Diagram refined successfully ✨",
      ...refined,
    });
  } catch (err) {
    console.error("Diagram refinement failed:", err);
    res.status(500).json({
      success: false,
      error: "Diagram refinement failed",
      detail: err.message || String(err),
    });
  }
});

export default router;
