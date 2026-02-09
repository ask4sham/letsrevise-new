/**
 * Canonical mapping from access-layer errors to HTTP status codes.
 *
 * This must be the ONLY place that decides:
 * - 401 vs 403 vs 404
 *
 * All API routes must call this helper to avoid drift.
 */
export type AccessError = "NOT_AUTHENTICATED" | "NOT_ENTITLED" | "NOT_PUBLISHED";

export function mapAccessErrorToStatus(error: AccessError): number {
  if (error === "NOT_AUTHENTICATED") return 401;
  if (error === "NOT_PUBLISHED") return 404;
  return 403;
}
