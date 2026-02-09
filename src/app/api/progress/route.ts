import { NextResponse } from "next/server";
import { getLessonWithAccess, getUserEntitlementsFromRequest, getLessonAccessMeta, mapAccessErrorToStatus } from "@/server";

/**
 * TODO: Replace getProgressPayload with your real progress loader.
 * The access gate MUST remain in place.
 */
async function getProgressPayload(lessonId: string) {
  // Should load user progress for the lesson from DB/storage.
  return { lessonId, progress: { completed: false, percent: 0 }, metadata: {} };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lessonId");

  if (!lessonId) {
    return NextResponse.json({ error: "MISSING_LESSON_ID" }, { status: 400 });
  }

  const user = await getUserEntitlementsFromRequest(req);

  const result = await getLessonWithAccess({
    lessonId,
    user,
    getLessonMeta: getLessonAccessMeta,
    getLessonPayload: getProgressPayload,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: mapAccessErrorToStatus(result.error) }
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
