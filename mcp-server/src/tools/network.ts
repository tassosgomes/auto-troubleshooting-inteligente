import fetch from "node-fetch";

export interface HttpResult {
  status_code: number | null;
  response_time_ms: number;
  error?: string;
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const ALLOWED_METHODS = new Set(["GET", "POST", "HEAD"]);

function normalizeTimeout(timeout?: number): number {
  if (typeof timeout !== "number" || Number.isNaN(timeout) || timeout <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return timeout;
}

function normalizeMethod(method?: string): string {
  const normalized = (method ?? "GET").toUpperCase();
  return ALLOWED_METHODS.has(normalized) ? normalized : "GET";
}

function resolveErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const typedError = error as { code?: string; cause?: { code?: string } };
  return typedError.code ?? typedError.cause?.code;
}

function resolveHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function mapErrorMessage(error: unknown, url: string, timeout: number): string {
  const typedError = error as { name?: string; message?: string };

  if (typedError?.name === "AbortError") {
    return `Timeout após ${timeout}ms`;
  }

  const errorCode = resolveErrorCode(error);
  if (errorCode === "ENOTFOUND") {
    const hostname = resolveHostname(url);
    return hostname ? `DNS não resolvido: ${hostname}` : "DNS não resolvido";
  }
  if (errorCode === "ECONNREFUSED") {
    return `Conexão recusada: ${url}`;
  }
  if (errorCode === "ECONNRESET") {
    return "Conexão resetada pelo servidor";
  }

  return typedError?.message || "Unknown error";
}

export async function httpRequest(
  url: string,
  method: string = "GET",
  timeout: number = DEFAULT_TIMEOUT_MS
): Promise<HttpResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const effectiveTimeout = normalizeTimeout(timeout);
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    const response = await fetch(url, {
      method: normalizeMethod(method),
      signal: controller.signal,
      headers: {
        "User-Agent": "Auto-Troubleshooting/1.0",
      },
    });

    const responseTime = Date.now() - startTime;
    clearTimeout(timeoutId);

    return {
      status_code: response.status,
      response_time_ms: responseTime,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    clearTimeout(timeoutId);

    return {
      status_code: null,
      response_time_ms: responseTime,
      error: mapErrorMessage(error, url, effectiveTimeout),
    };
  }
}