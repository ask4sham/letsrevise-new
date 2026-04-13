import { NextResponse } from "next/server";
import { getUserEntitlementsFromRequest } from "@/server";

/**
 * Unlock a lesson (subscription / entitlement check — no per-lesson coin spend).
 * IMPORTANT:
 * - Must be server-side (never trust client)
 * - Must verify auth
 * - Must be idempotent
 *
 * TODO: Wire to DB: verify subscription or purchasedLessons, then grant access.
 */
export async function POST(req: Request) {
  const user = await getUserEntitlementsFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const lessonId = body?.lessonId;

  if (!lessonId || typeof lessonId !== "string") {
    return NextResponse.json({ error: "MISSING_LESSON_ID" }, { status: 400 });
  }

  // TEMP stub (no DB yet). Replace with real entitlement logic.
  return NextResponse.json(
    {
      ok: false,
      error: "NOT_IMPLEMENTED",
      message: "Unlock flow requires server-side entitlement checks.",
    },
    { status: 501 }
  );
}
