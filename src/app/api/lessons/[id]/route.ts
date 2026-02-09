import { NextResponse } from "next/server";
import { getLessonWithAccess, getUserEntitlementsFromRequest, mapAccessErrorToStatus } from "@/server";
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
    return NextResponse.json(
      { error: result.error },
      { status: mapAccessErrorToStatus(result.error) }
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
