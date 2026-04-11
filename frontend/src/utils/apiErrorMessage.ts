/**
 * Normalize backend error payloads (sendInternalError + legacy shapes).
 * Fetch/JSON: use getErrorMessageFromData.
 * Standalone axios: use getAxiosErrorMessage.
 * Shared api.ts client: reject shape is { message, status, data } — use getApiClientErrorMessage.
 */

export function getErrorMessageFromData(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const d = data as Record<string, unknown>;
  const raw = d.msg ?? d.error ?? d.message;
  if (typeof raw === "string" && raw.trim()) return raw;
  return fallback;
}

/** Raw Axios error (e.g. standalone `import axios from "axios"`). */
export function getAxiosErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  return getErrorMessageFromData(data, fallback);
}

/**
 * Error from `import api from "../services/api"` after the response interceptor rejects
 * with `{ message, status, data }` (no `response` on the thrown object).
 */
export function getApiClientErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const e = err as Record<string, unknown>;
  if (typeof e.message === "string" && e.message.trim()) return e.message as string;
  return getErrorMessageFromData(e.data, fallback);
}

/** Works for api client reject `{ status }` and raw Axios `error.response.status`. */
export function getHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e.status === "number") return e.status;
  const resp = (e as { response?: { status?: number } }).response;
  if (resp && typeof resp.status === "number") return resp.status;
  return undefined;
}
