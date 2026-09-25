export class NansenError extends Error {
  override name = "NansenError";
}

/** Structured API error body, per https://docs.nansen.ai/getting-started/error-handling */
export interface NansenErrorBody {
  error?: string;
  message?: string;
  code?: string;
  status?: number;
  request_id?: string;
  doc_url?: string;
  param?: string;
  retry_after?: number;
}

export const RETRYABLE_CODES = new Set([
  "rate_limit_exceeded",
  "query_timeout",
  "upstream_unavailable",
  "internal_error",
]);
export const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export class NansenApiError extends NansenError {
  override name = "NansenApiError";
  readonly status: number;
  readonly code: string | undefined;
  readonly requestId: string | undefined;
  readonly param: string | undefined;
  readonly retryAfterSec: number | undefined;
  readonly endpoint: string;
  readonly body: NansenErrorBody | string | undefined;

  constructor(endpoint: string, status: number, body: NansenErrorBody | string | undefined, retryAfterHeader?: string | null) {
    const parsed = typeof body === "object" && body ? body : undefined;
    const msg = parsed?.message ?? parsed?.error ?? (typeof body === "string" ? body.slice(0, 300) : `HTTP ${status}`);
    super(`Nansen ${status}${parsed?.code ? ` [${parsed.code}]` : ""} on ${endpoint}: ${msg}`);
    this.endpoint = endpoint;
    this.status = status;
    this.body = body;
    this.code = parsed?.code;
    this.requestId = parsed?.request_id;
    this.param = parsed?.param;
    const ra = parsed?.retry_after ?? (retryAfterHeader ? Number(retryAfterHeader) : undefined);
    this.retryAfterSec = Number.isFinite(ra) ? ra : undefined;
  }

  get retryable(): boolean {
    if (this.code && RETRYABLE_CODES.has(this.code)) return true;
    if (this.code && !RETRYABLE_CODES.has(this.code) && this.status < 500 && this.status !== 429) return false;
    return RETRYABLE_STATUSES.has(this.status);
  }
}

export class CreditCapExceededError extends NansenError {
  override name = "CreditCapExceededError";
  constructor(
    readonly endpoint: string,
    readonly estimated: number,
    readonly spent: number,
    readonly reserved: number,
    readonly cap: number,
  ) {
    super(
      `Credit cap ${cap} would be exceeded by ${endpoint} (est. ${estimated}; spent ${spent}, in flight ${reserved}). ` +
        `Raise NANSEN_CREDIT_CAP or pass { creditCap } to createNansen().`,
    );
  }
}

export class NansenTimeoutError extends NansenError {
  override name = "NansenTimeoutError";
  constructor(readonly endpoint: string, readonly timeoutMs: number) {
    super(`Nansen request to ${endpoint} timed out after ${timeoutMs}ms`);
  }
}

export class NansenConfigError extends NansenError {
  override name = "NansenConfigError";
}
