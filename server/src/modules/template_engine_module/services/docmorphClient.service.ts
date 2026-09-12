import { env } from '../../../core/config/env.ts';

export interface SourceAsset {
  url: string;
  filename: string;
  contentType?: string;
}

export interface GenerateReportRequest {
  template: SourceAsset;
  raw?: SourceAsset;
  rawText?: string;
  includeDiagrams?: boolean;
}

export interface TrainConfirmRequest {
  source: SourceAsset;
  approvedMapping: Record<string, string>;
  templateName?: string;
}

export interface GenerateDiagramsRequest {
  raw?: SourceAsset;
  rawFilename?: string;
  rawText?: string;
}

export interface RefineDiagramRequest {
  currentMermaid: string;
  instruction: string;
  rawText?: string;
}

export interface DocMorphError extends Error { status?: number; data?: unknown; }
export interface TemplateResponse { success?: boolean; message?: string; filename?: string; fields?: string[]; objectKey?: string; }
export interface GenerationResponse {
  success?: boolean;
  message?: string;
  docxUrl?: string;
  pdfUrl?: string | null;
  docxKey?: string;
  pdfKey?: string | null;
  docxSize?: number;
  pdfSize?: number | null;
  data?: Record<string, unknown>;
  diagrams?: Record<string, unknown>;
  detectedFields?: string[];
}
export interface TrainingResponse { success?: boolean; message?: string; templateUrl?: string; templateKey?: string; appliedFields?: string[]; skippedFields?: string[]; suggestions?: Record<string, unknown>; }

class DocMorphClient {
  private readonly baseUrl = env.TEMPLATE_ENGINE_URL.replace(/\/$/, '');
  private consecutiveFailures = 0;
  private openedAt = 0;

  private async fetchWithResilience(url: string, init: RequestInit = {}): Promise<Response> {
    if (this.consecutiveFailures >= env.TEMPLATE_ENGINE_FAILURE_THRESHOLD) {
      if (Date.now() - this.openedAt < env.TEMPLATE_ENGINE_COOLDOWN_MS) {
        throw Object.assign(new Error('Template engine is temporarily unavailable'), { status: 503 });
      }
      this.consecutiveFailures = 0;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= env.TEMPLATE_ENGINE_MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), env.TEMPLATE_ENGINE_TIMEOUT_MS);
      try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          this.consecutiveFailures = 0;
          return response;
        }
        lastError = new Error(`Template engine returned ${response.status}`);
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timer);
      }
      if (attempt < env.TEMPLATE_ENGINE_MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= env.TEMPLATE_ENGINE_FAILURE_THRESHOLD) this.openedAt = Date.now();
    const isTimeout = lastError instanceof Error && lastError.name === 'AbortError';
    const failureMessage = isTimeout
      ? `Template engine request timed out after ${env.TEMPLATE_ENGINE_TIMEOUT_MS}ms`
      : 'Template engine request failed';
    throw Object.assign(new Error(failureMessage, { cause: lastError }), { status: 503 });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchWithResilience(`${this.baseUrl}${path}`, init);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? String(payload.message)
          : `DocMorph request failed with status ${response.status}`;
      const error = new Error(message) as DocMorphError;
      Object.assign(error, { status: response.status, data: payload });
      throw error;
    }

    return payload as T;
  }

  uploadTemplate(source: SourceAsset, requestId?: string): Promise<TemplateResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (requestId) headers['x-request-id'] = requestId;
    return this.request<TemplateResponse>('/api/template', { method: 'POST', headers, body: JSON.stringify(source) });
  }

  trainAnalyze(source: SourceAsset, requestId?: string): Promise<TrainingResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (requestId) headers['x-request-id'] = requestId;
    return this.request<TrainingResponse>('/api/train/analyze', { method: 'POST', headers, body: JSON.stringify(source) });
  }

  generateReport(body: GenerateReportRequest, requestId?: string): Promise<GenerationResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (requestId) headers['x-request-id'] = requestId;
    return this.request<GenerationResponse>('/api/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  trainConfirm(body: TrainConfirmRequest, requestId?: string): Promise<TrainingResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (requestId) headers['x-request-id'] = requestId;
    return this.request<TrainingResponse>('/api/train/confirm', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  generateDiagrams(body: GenerateDiagramsRequest, requestId?: string): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (requestId) headers['x-request-id'] = requestId;
    return this.request<Record<string, unknown>>('/api/diagrams/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  refineDiagram(body: RefineDiagramRequest, requestId?: string): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (requestId) headers['x-request-id'] = requestId;
    return this.request<Record<string, unknown>>('/api/diagrams/refine', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  getHealth(requestId?: string): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {};
    if (requestId) headers['x-request-id'] = requestId;
    return this.request<Record<string, unknown>>('/api/health', { headers });
  }
}

export const docmorphClient = new DocMorphClient();
