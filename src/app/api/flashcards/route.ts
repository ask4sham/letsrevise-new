import { NextResponse } from "next/server";
import { getLessonWithAccess, getUserEntitlementsFromRequest } from "@/server";
import { getLessonAccessMeta } from "@/server/lessons/lessonAccessMeta";

/**
 * TODO: Replace getFlashcardsPayload with your real flashcards artifact loader.
 * The access gate MUST remain in place.
 */
async function getFlashcardsPayload(lessonId: string) {
  // Should load your flashcards JSON artifact from storage (S3/R2/filesystem).
  return { lessonId, flashcards: { items: [] }, metadata: {} };
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
    getLessonPayload: getFlashcardsPayload,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "NOT_AUTHENTICATED" ? 401 : 403 }
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
