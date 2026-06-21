import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI features will not work.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export function getModel(modelName: "flash" | "pro" = "flash"): GenerativeModel {
  if (!genAI) {
    throw new Error("Gemini AI not initialized. Check GEMINI_API_KEY.");
  }
  const model = modelName === "pro" ? "gemini-2.5-pro-exp-03-25" : "gemini-2.5-flash-preview-04-17";
  return genAI.getGenerativeModel({ model });
}

export async function generateWithAI(
  prompt: string,
  modelName: "flash" | "pro" = "flash"
): Promise<string> {
  const model = getModel(modelName);
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

export async function generateStructuredJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  modelName: "flash" | "pro" = "flash"
): Promise<T> {
  const model = getModel(modelName);
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, no explanation.`;
  const result = await model.generateContent(fullPrompt);
  const text = result.response.text();
  
  // Strip markdown code blocks if present
  const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    // Try to extract JSON from the response
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
    throw new Error("Failed to parse AI response as JSON");
  }
}
