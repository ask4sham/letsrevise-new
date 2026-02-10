import { NextResponse } from "next/server";
import { getUserEntitlementsFromRequest } from "@/server";

/**
 * Unlock a lesson (spend ShamCoins / record purchase).
 * IMPORTANT:
 * - Must be server-side (never trust client)
 * - Must verify auth
 * - Must be idempotent (unlocking twice should not double-charge)
 *
 * TODO: Wire to DB transaction:
 * - check coin balance
 * - decrement coins
 * - add lessonId to purchasedLessons
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

  // TEMP stub (no DB yet). Replace with real purchase logic.
  return NextResponse.json(
    {
      ok: false,
      error: "NOT_IMPLEMENTED",
      message: "Unlock flow requires DB transaction (coins + purchase record).",
    },
    { status: 501 }
  );
}
