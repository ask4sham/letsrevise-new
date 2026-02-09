import { NextResponse } from "next/server";
import { getLessonAccessMeta } from "@/server";

/**
 * Public lesson index.
 * IMPORTANT:
 * - Metadata only (NO lesson content, slots, quizzes, etc.)
 * - Used by dashboards to list all lessons (locked/unlocked state decided client-side)
 */
async function getLessonIndex() {
  // TEMP: single-lesson example using canonical metadata
  const meta = await getLessonAccessMeta("L1");
  return [
    {
      lessonId: meta.lessonId,
      title: "Example Lesson",
      isPublished: meta.isPublished,
      isFreePreview: meta.isFreePreview,
    },
  ];
}

export async function GET() {
  const lessons = await getLessonIndex();
  return NextResponse.json({ lessons }, { status: 200 });
}
