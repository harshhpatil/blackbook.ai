import { env } from '../../../core/config/env.ts';

export interface GenerateReportRequest {
  templateFilename: string;
  rawFilename?: string;
  rawText?: string;
  includeDiagrams?: boolean;
}

export interface TrainConfirmRequest {
  filename: string;
  approvedMapping: Record<string, string>;
  templateName?: string;
}

export interface GenerateDiagramsRequest {
  rawFilename?: string;
  rawText?: string;
}

export interface RefineDiagramRequest {
  currentMermaid: string;
  instruction: string;
  rawText?: string;
}

export type DocMorphResponse = Record<string, any>;

const RELATIVE_PATH_PATTERN = /^(\/(?:outputs|templates|uploads)\/[^\s"']*)$/;

/** Prefixes DocMorph asset paths so API consumers can use them directly. */
export function normalizeDocMorphUrls<T>(value: T): T {
  if (typeof value === 'string' && RELATIVE_PATH_PATTERN.test(value)) {
    return new URL(value, env.DOCMORPH_SERVICE_URL).toString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeDocMorphUrls(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeDocMorphUrls(item)])
    ) as T;
  }

  return value;
}

class DocMorphClient {
  private readonly baseUrl = env.DOCMORPH_SERVICE_URL.replace(/\/$/, '');

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? String(payload.message)
          : `DocMorph request failed with status ${response.status}`;
      const error = new Error(message);
      Object.assign(error, { status: response.status, data: payload });
      throw error;
    }

    return normalizeDocMorphUrls(payload as T);
  }

  private async upload<T>(
    path: string,
    fieldName: string,
    file: Express.Multer.File,
    textFields: Record<string, string> = {}
  ): Promise<T> {
    const form = new FormData();
    const bytes = new Uint8Array(file.buffer.byteLength);
    bytes.set(file.buffer);
    form.append(fieldName, new Blob([bytes.buffer], { type: file.mimetype }), file.originalname);
    for (const [key, value] of Object.entries(textFields)) form.append(key, value);
    return this.request<T>(path, { method: 'POST', body: form });
  }

  uploadTemplate(file: Express.Multer.File): Promise<DocMorphResponse> {
    return this.upload<DocMorphResponse>('/api/template', 'template', file);
  }

  uploadRaw(file: Express.Multer.File): Promise<DocMorphResponse> {
    return this.upload<DocMorphResponse>('/api/raw', 'raw', file);
  }

  analyzeImage(file: Express.Multer.File, imageName?: string): Promise<DocMorphResponse> {
    return this.upload<DocMorphResponse>('/api/analyze-image', 'image', file, imageName ? { imageName } : {});
  }

  trainAnalyze(file: Express.Multer.File): Promise<DocMorphResponse> {
    return this.upload<DocMorphResponse>('/api/train/analyze', 'filledDoc', file);
  }

  generateReport(body: GenerateReportRequest): Promise<DocMorphResponse> {
    return this.request<DocMorphResponse>('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  trainConfirm(body: TrainConfirmRequest): Promise<DocMorphResponse> {
    return this.request<DocMorphResponse>('/api/train/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  generateDiagrams(body: GenerateDiagramsRequest): Promise<DocMorphResponse> {
    return this.request<DocMorphResponse>('/api/diagrams/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  refineDiagram(body: RefineDiagramRequest): Promise<DocMorphResponse> {
    return this.request<DocMorphResponse>('/api/diagrams/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  getHealth(): Promise<DocMorphResponse> {
    return this.request<DocMorphResponse>('/api/health');
  }
}

export const docmorphClient = new DocMorphClient();
