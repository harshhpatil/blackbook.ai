import "dotenv/config";
import express from "express";

import templateRoutes from "./routes/upload.js";
import generateRoutes from "./routes/generate.js";
import trainRoutes from "./routes/train.js";
import diagramRoutes from "./routes/diagrams.js";
import { getGeminiStatus } from "./services/geminiStatus.js";
import { logger, httpLogger } from "./services/logger.js";

const app = express();

app.use(httpLogger);
app.use(express.json({ limit: "50mb" }));

app.use("/api", templateRoutes);
app.use("/api", generateRoutes);
app.use("/api", trainRoutes);
app.use("/api", diagramRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    status: "alive",
    message: "DocMorph AI server running 🔥",
    gemini: getGeminiStatus(),
  });
});

// Global error-handling middleware
app.use((err, req, res, next) => {
  const reqLog = req.log || logger;
  reqLog.error({ err, path: req.path }, "Unhandled error in template engine");
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  logger.info({ port: PORT }, `DocMorph AI server cooking on http://localhost:${PORT}`);
});
