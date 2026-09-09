import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.join(__dirname, "..", ".cache");

if (!fs.existsSync(cacheDir)) {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

function hashKey(str) {
  return crypto.createHash("sha256").update(String(str).trim()).digest("hex");
}

export function getCachedResult(namespace, key) {
  const file = path.join(cacheDir, `${namespace}_${hashKey(key)}.json`);
  if (fs.existsSync(file)) {
    try {
      const data = fs.readFileSync(file, "utf8");
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function setCachedResult(namespace, key, data) {
  const file = path.join(cacheDir, `${namespace}_${hashKey(key)}.json`);
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.warn("Cache write warning:", e.message);
  }
}
