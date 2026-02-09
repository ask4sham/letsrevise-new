import { NextResponse } from "next/server";
import { getLessonWithAccess, getUserEntitlementsFromRequest } from "@/server";
import { getLessonAccessMeta } from "@/server/lessons/lessonAccessMeta";

async function getLessonPayload(lessonId: string) {
  // Should load your lesson JSON artifact from storage (S3/R2/filesystem).
  return { lessonId, slots: [], metadata: {} };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserEntitlementsFromRequest(req);

  const result = await getLessonWithAccess({
    lessonId: params.id,
    user,
    getLessonMeta: getLessonAccessMeta,
    getLessonPayload,
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
