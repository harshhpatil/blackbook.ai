/**
 * Safely parse JSON strings returned by AI models that may contain
 * unescaped control characters (0x00-0x1F), raw newlines/tabs inside string literals,
 * trailing commas, or markdown wrapping.
 */
export function safeJsonParse(raw) {
  if (!raw || typeof raw !== "string") return {};

  let clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // 1. Try direct parse
  try {
    return JSON.parse(clean);
  } catch (err) {
    // Proceed to extraction and sanitization
  }

  // 2. Extract outermost JSON structure if extra conversational text exists
  const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (match) {
    clean = match[0];
  }

  try {
    return JSON.parse(clean);
  } catch (err) {
    // Proceed to character-level sanitization
  }

  // 3. Sanitize bad control characters inside JSON strings
  // Replace raw literal newlines/tabs inside quotes, and remove invalid control chars (0x00 to 0x1F)
  let sanitized = "";
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const code = clean.charCodeAt(i);

    if (inString) {
      if (isEscaped) {
        sanitized += char;
        isEscaped = false;
      } else if (char === "\\") {
        sanitized += char;
        isEscaped = true;
      } else if (char === '"') {
        sanitized += char;
        inString = false;
      } else if (char === "\n") {
        sanitized += "\\n";
      } else if (char === "\r") {
        sanitized += "\\r";
      } else if (char === "\t") {
        sanitized += "\\t";
      } else if (code < 32) {
        // Drop non-printable control characters (0x00 to 0x1F)
      } else {
        sanitized += char;
      }
    } else {
      if (char === '"') {
        inString = true;
      }
      sanitized += char;
    }
  }

  // Remove trailing commas before } or ]
  sanitized = sanitized.replace(/,\s*([\}\]])/g, "$1");

  try {
    return JSON.parse(sanitized);
  } catch (err) {
    console.warn("Direct sanitized parse failed, using regex fallback extractor:", err.message);
  }

  // 4. Fallback: Key-Value regex extractor for object JSON
  const result = {};
  const kvRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*("(?:[^"\\]*(?:\\.[^"\\]*)*)"|\{[^}]*\}|\[[^\]]*\]|true|false|null|-?\d+(?:\.\d+)?)/g;
  let m;
  while ((m = kvRegex.exec(sanitized || clean)) !== null) {
    try {
      const k = m[1];
      let val = m[2];
      if (val.startsWith('"')) {
        val = JSON.parse(val);
      }
      result[k] = val;
    } catch (e) {
      // ignore individual malformed field
    }
  }

  if (Object.keys(result).length > 0) {
    return result;
  }

  throw new Error("Unable to parse AI response into valid JSON");
}
