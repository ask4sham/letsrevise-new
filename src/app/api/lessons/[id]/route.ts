import { NextResponse } from "next/server";
import { getLessonWithAccess } from "@/server/http/getLessonWithAccess";
import { getUserEntitlementsFromRequest } from "@/server/auth/getUserEntitlementsFromRequest";

async function getLessonMeta(lessonId: string) {
  // Should come from your lesson index / published metadata store.
  return { lessonId, isFreePreview: false };
}

async function getLessonPayload(lessonId: string) {
  // Should load your lesson JSON artifact from storage (S3/R2/filesystem).
  return { lessonId, slots: [], metadata: {} };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserEntitlementsFromRequest(req);

  const result = await getLessonWithAccess({
    lessonId: params.id,
    user,
    getLessonMeta,
    getLessonPayload,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "NOT_AUTHENTICATED" ? 401 : 403 }
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
