export type AccessError = "NOT_AUTHENTICATED" | "NOT_ENTITLED" | "NOT_PUBLISHED";

export function mapAccessErrorToStatus(error: AccessError): number {
  if (error === "NOT_AUTHENTICATED") return 401;
  if (error === "NOT_PUBLISHED") return 404;
  return 403;
}
