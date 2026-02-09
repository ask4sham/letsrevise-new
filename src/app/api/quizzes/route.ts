import { NextResponse } from "next/server";
import { getLessonWithAccess, getUserEntitlementsFromRequest, getLessonAccessMeta } from "@/server";

/**
 * TODO: Replace getQuizPayload with your real quiz artifact loader.
 * The access gate MUST remain in place.
 */
async function getQuizPayload(lessonId: string) {
  // Should load your quiz JSON artifact from storage (S3/R2/filesystem).
  return { lessonId, quiz: { items: [] }, metadata: {} };
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
    getLessonPayload: getQuizPayload,
  });

  if (!result.ok) {
    const status =
      result.error === "NOT_AUTHENTICATED"
        ? 401
        : result.error === "NOT_PUBLISHED"
        ? 404
        : 403;

    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.data, { status: 200 });
}
