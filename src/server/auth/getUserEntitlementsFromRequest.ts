/**
 * Single source of truth for resolving user entitlements from a request.
 * All API routes should call this (never inline auth logic).
 *
 * TODO:
 * - Read session / JWT / cookie
 * - Load subscription + purchases from DB
 */
export async function getUserEntitlementsFromRequest(_req: Request) {
  return null as {
    userId: string;
    subscriptionActive: boolean;
    purchasedLessons: string[];
  } | null;
}
