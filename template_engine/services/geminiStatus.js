const state = {
  status: 'unknown',
  rateLimitReached: false,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastErrorCode: null,
  retryAfterSeconds: null,
  usage: {
    requests: 0,
    promptTokens: 0,
    outputTokens: 0,
    thoughtTokens: 0,
    totalTokens: 0,
    byOperation: {},
  },
};

const asNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const errorStatus = (error) => {
  if (typeof error?.status === 'number') return error.status;
  const match = String(error?.message || '').match(/\b(429|500|502|503)\b/);
  return match ? Number(match[1]) : null;
};

const retryAfterSeconds = (error) => {
  const match = String(error?.message || '').match(
    /retry(?: in|Delay[^\d]*)([\d.]+)s/i
  );
  return match ? Math.ceil(Number(match[1])) : null;
};

/** Records the last known provider result without issuing an extra API request. */
export function recordGeminiSuccess(response, operation = 'unknown') {
  const usage = response?.usageMetadata || {};
  const promptTokens = asNumber(usage.promptTokenCount);
  const outputTokens = asNumber(usage.candidatesTokenCount);
  const thoughtTokens = asNumber(usage.thoughtsTokenCount);
  const totalTokens =
    asNumber(usage.totalTokenCount) ||
    promptTokens + outputTokens + thoughtTokens;
  const operationUsage = state.usage.byOperation[operation] || {
    requests: 0,
    promptTokens: 0,
    outputTokens: 0,
    thoughtTokens: 0,
    totalTokens: 0,
  };

  state.usage.requests += 1;
  state.usage.promptTokens += promptTokens;
  state.usage.outputTokens += outputTokens;
  state.usage.thoughtTokens += thoughtTokens;
  state.usage.totalTokens += totalTokens;
  operationUsage.requests += 1;
  operationUsage.promptTokens += promptTokens;
  operationUsage.outputTokens += outputTokens;
  operationUsage.thoughtTokens += thoughtTokens;
  operationUsage.totalTokens += totalTokens;
  state.usage.byOperation[operation] = operationUsage;

  state.status = 'available';
  state.rateLimitReached = false;
  state.lastSuccessAt = new Date().toISOString();
  state.lastErrorCode = null;
  state.retryAfterSeconds = null;
}

export function recordGeminiFailure(error) {
  const status = errorStatus(error);
  const limited =
    status === 429 ||
    String(error?.message || '').includes('RESOURCE_EXHAUSTED');

  state.status = limited
    ? 'rate_limited'
    : status === 503
      ? 'unavailable'
      : 'error';
  state.rateLimitReached = limited;
  state.lastFailureAt = new Date().toISOString();
  state.lastErrorCode = status;
  state.retryAfterSeconds = retryAfterSeconds(error);
}

export function getGeminiStatus() {
  const configured = Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.USE_VERTEX_AI === 'true' ||
    Boolean(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT)
  );
  return {
    configured,
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    ...state,
    // These counters cover only this running container, from its most recent start.
    usage: {
      ...state.usage,
      byOperation: { ...state.usage.byOperation },
    },
  };
}
