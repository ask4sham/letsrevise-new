/**
 * Email verification helpers — align with backend verificationStatus + optional emailVerified on auth payloads.
 */
export function isEmailVerified(
  user: { verificationStatus?: string; emailVerified?: boolean } | null | undefined
): boolean {
  if (!user) return false;
  if (typeof user.emailVerified === "boolean") return user.emailVerified;
  return (user.verificationStatus || "").toLowerCase() === "verified";
}
