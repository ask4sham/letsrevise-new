import { NextResponse } from "next/server";
import { getUserEntitlementsFromRequest } from "@/server";

/**
 * Frontend uses this to render locked/unlocked state + CTAs.
 * IMPORTANT: No lesson content here.
 */
export async function GET(req: Request) {
  const user = await getUserEntitlementsFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  return NextResponse.json(
    {
      userId: user.userId,
      subscriptionActive: user.subscriptionActive,
      purchasedLessons: user.purchasedLessons,
      // TODO: add shamCoinsBalance once DB is wired
    },
    { status: 200 }
  );
}
