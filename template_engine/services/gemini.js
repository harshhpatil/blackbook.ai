import { GoogleGenAI } from "@google/genai";
import { safeJsonParse } from "./safeJson.js";
import { getCachedResult, setCachedResult } from "./cache.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// Lazy — client is created on first call, not at import time.
// This guarantees dotenv has already run before the key is read.
let _ai = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add it to server/.env and restart the server."
    );
  }
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _ai;
}

const SYSTEM_INSTRUCTION = `You are an Elite Academic Thesis Advisor, Senior Engineering Architect, and Technical Black Book Author.
Your mission is to take unstructured, casual, raw, or fragmented project notes (such as bullet points, rough summaries, code snippets, git commit logs, or student thoughts) and author a comprehensive, publication-grade academic Black Book / Engineering Project Report.

Focus: The report body strictly from Index/Abstract through all technical chapters to References (ignoring front-matter administrative certificate pages).

Core Principles:
1. NEVER RETURN EMPTY STRINGS OR STUB FRAGMENTS for conceptual or academic sections. If a field is present in the requested fields (such as abstract, problem_statement, objectives, methodology, architecture, testing, future_scope, conclusion, literature_survey, etc.), you MUST deeply analyze the project concept, tech stack, and goals, and author thorough, highly articulated, academic-grade engineering content.
2. PRESERVE GROUND TRUTH: Strictly retain and highlight all user-specified tools, libraries, hardware parts, team names, or experimental metrics provided in the raw notes. Never contradict the user's stated stack.
3. ACADEMIC TONE & RIGOR:
   - Use formal third-person / passive academic voice (e.g. "The system was designed...", "It is observed that...").
   - Use precise technical terminology and rich, detailed explanations.
   - For narrative chapters (Abstract, Introduction, Problem Statement, Literature Survey, Methodology, Architecture, Testing, Results, Conclusion), provide multi-paragraph, in-depth academic explanations rather than 1-2 sentence summaries.
   - For specification/list fields (Objectives, Requirements, Tools), format as clear, organized bulleted or numbered items.
   - For References, provide valid IEEE-style formatted citations relevant to the project's domain.
4. RELEVANCE & INTELLIGENCE: If metadata like project title is missing or informal, infer a professional, publication-worthy academic title. If student or guide names are missing and requested, provide standard formal placeholders or infer from context.
5. FORMATTING: Return a JSON object with EXACTLY the requested keys. Each key's value should be a clean, ready-to-print string (use newlines for paragraph breaks or bullet points).`;

function buildPrompt(rawText, fieldNames) {
  const fieldList = fieldNames.map((f) => `- "${f}"`).join("\n");
  return `TARGET FIELDS TO GENERATE FOR THE BLACK BOOK:
${fieldList}

RAW PROJECT NOTES / UNSTRUCTURED DATA:
"""
${rawText}
"""

Author comprehensive, high-quality, professional Black Book content for every requested field. Return valid JSON where each key is one of the requested field names and its value is the synthesized text.`;
}

function normalizeFieldValue(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (Array.isArray(val)) {
    return val
      .map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item)))
      .join("\n");
  }
  if (typeof val === "object") {
    return Object.entries(val)
      .map(([k, v]) => `• ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join("\n");
  }
  return String(val);
}

async function callWithRetry(fn, maxRetries = 3, delayMs = 1500) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isRateLimit =
        err.message?.includes("429") ||
        err.message?.includes("RESOURCE_EXHAUSTED") ||
        err.status === 429;
      const isUnavailable =
        err.message?.includes("503") ||
        err.message?.includes("high demand") ||
        err.message?.includes("UNAVAILABLE") ||
        err.status === 503;

      if ((isRateLimit || isUnavailable) && attempt < maxRetries) {
        // Check for retryDelay in error details
        let wait = delayMs * attempt;
        const delayMatch = err.message?.match(/retry in ([\d\.]+)s/i) || err.message?.match(/"retryDelay":\s*"(\d+)s"/i);
        if (delayMatch) {
          const secs = Math.min(10, Math.ceil(parseFloat(delayMatch[1])));
          wait = secs * 1000;
        }
        console.warn(`Gemini rate limit / busy (attempt ${attempt}/${maxRetries}), waiting ${Math.round(wait / 1000)}s...`);
        await new Promise((res) => setTimeout(res, wait));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function extractStructuredData(rawText, fieldNames) {
  if (!fieldNames || fieldNames.length === 0) {
    throw new Error("No fields provided — template has no {{placeholders}}");
  }

  // Check cache first
  const cacheKey = `${rawText}_${fieldNames.sort().join(",")}`;
  const cached = getCachedResult("text_extraction", cacheKey);
  if (cached) {
    return cached;
  }

  const ai = getClient();
  const response = await callWithRetry(() =>
    ai.models.generateContent({
      model: MODEL,
      contents: buildPrompt(rawText, fieldNames),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    })
  );

  const parsed = safeJsonParse(response.text);

  const filtered = {};
  for (const field of fieldNames) {
    filtered[field] = normalizeFieldValue(parsed[field] ?? "");
  }

  // Cache successful result
  setCachedResult("text_extraction", cacheKey, filtered);
  return filtered;
}

/**
 * analyzeProjectImage — uses Gemini Vision to generate a short academic summary
 * for a project output image given its buffer (as Buffer) and user-provided label.
 * @param {Buffer} imageBuffer - raw image bytes
 * @param {string} mimeType   - e.g. "image/png" | "image/jpeg"
 * @param {string} imageName  - the label the user gave to this output (e.g. "Dashboard Screenshot")
 * @returns {Promise<string>} - 2-3 sentence summary
 */
export async function analyzeProjectImage(imageBuffer, mimeType, imageName) {
  const ai = getClient();

  const base64Data = imageBuffer.toString("base64");

  const prompt = `You are reviewing a project output image labelled "${imageName}".
Write a precise, academic, 2-3 sentence summary describing what this image shows, what component or feature it represents, and its significance within the engineering project.
Be specific about visible UI elements, graphs, diagrams, or results. Do NOT start with "This image shows" — vary your opening.`;

  const response = await callWithRetry(() =>
    ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        temperature: 0.4,
        maxOutputTokens: 300,
      },
    })
  );

  return (response.text || "").trim();
}