import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.ts';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('gemini');
let client: GoogleGenAI | undefined;

export class GeminiGenerationError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly statusCode = 502,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'GeminiGenerationError';
  }
}

const getClient = (): GoogleGenAI => {
  client ??= new GoogleGenAI({ apiKey: env.GOOGLE_GEMINI_API_KEY });
  return client;
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const isRetryable = (error: unknown): boolean => {
  if (error instanceof GeminiGenerationError) return error.retryable;
  if (error instanceof Error && error.name === 'TimeoutError') return true;
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  const status = typeof candidate?.status === 'number'
    ? candidate.status
    : typeof candidate?.code === 'number' ? candidate.code : undefined;
  if (status === 408 || status === 429 || (status !== undefined && status >= 500)) return true;
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';
  return /timeout|timed out|network|econnreset|service unavailable|temporarily unavailable/.test(message);
};

export const assertGeminiInputSize = (text: string): void => {
  if (!text.trim()) throw new GeminiGenerationError('No readable text was available for AI extraction', false, 422);
  if (text.length > env.GEMINI_MAX_INPUT_CHARS) {
    throw new GeminiGenerationError(
      `Source text is too large for reliable AI extraction (maximum ${env.GEMINI_MAX_INPUT_CHARS} characters)`,
      false,
      413
    );
  }
};

interface GenerateJsonOptions {
  operation: 'extract' | 'train';
  prompt: string;
  responseJsonSchema?: unknown;
  validateResponse?: (text: string) => void;
}

export async function generateGeminiJson({
  operation,
  prompt,
  responseJsonSchema,
  validateResponse,
}: GenerateJsonOptions): Promise<string> {
  let lastError: unknown;
  const attempts = env.GEMINI_MAX_RETRIES + 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await getClient().models.generateContent({
        model: env.GOOGLE_GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema,
          temperature: 0,
          maxOutputTokens: env.GEMINI_MAX_OUTPUT_TOKENS,
          httpOptions: { timeout: env.GEMINI_TIMEOUT_MS },
          abortSignal: AbortSignal.timeout(env.GEMINI_TIMEOUT_MS),
        },
      });
      if (!response.text?.trim()) {
        throw new GeminiGenerationError('Gemini returned an empty response', true);
      }
      validateResponse?.(response.text);
      return response.text;
    } catch (error) {
      lastError = error;
      const retryable = isRetryable(error);
      if (!retryable || attempt === attempts) break;
      const delay = 500 * 2 ** (attempt - 1);
      log.warn({ operation, attempt, delay, error }, 'Gemini request failed; retrying');
      await sleep(delay);
    }
  }

  const retryable = isRetryable(lastError);
  const causeMessage = lastError instanceof Error ? lastError.message : 'unknown provider error';
  throw new GeminiGenerationError(
    `Gemini ${operation} request failed: ${causeMessage}`,
    retryable,
    retryable ? 503 : 502,
    { cause: lastError }
  );
}
