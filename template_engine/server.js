import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import templateRoutes from "./routes/upload.js";
import generateRoutes from "./routes/generate.js";
import trainRoutes from "./routes/train.js";
import diagramRoutes from "./routes/diagrams.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

// Static access to generated outputs and trained templates (for download links)
app.use("/outputs", express.static(path.join(__dirname, "outputs")));
app.use("/templates", express.static(path.join(__dirname, "templates")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api", templateRoutes);
app.use("/api", generateRoutes);
app.use("/api", trainRoutes);
app.use("/api", diagramRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "alive", message: "DocMorph AI server running 🔥" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`DocMorph AI server cooking on http://localhost:${PORT}`);
});
