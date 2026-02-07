export function getTrialDaysRemaining(
  entitlements?: {
    isTrial: boolean;
    expiresAt: string | null;
  }
): number | null {
  if (
    !entitlements ||
    !entitlements.isTrial ||
    entitlements.expiresAt === null
  ) {
    return null;
  }

  const expiresAtTime = new Date(entitlements.expiresAt).getTime();
  if (Number.isNaN(expiresAtTime)) {
    return null;
  }

  const now = Date.now();
  const diffMs = expiresAtTime - now;

  if (diffMs <= 0) {
    return 0;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(diffMs / msPerDay);
}

