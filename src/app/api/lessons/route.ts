import { NextResponse } from "next/server";

/**
 * Public lesson index.
 * IMPORTANT:
 * - Metadata only (NO lesson content, slots, quizzes, etc.)
 * - Used by dashboards to list all lessons (locked/unlocked state decided client-side)
 */
async function getLessonIndex() {
  // TODO: Replace with DB/index-backed lookup.
  return [
    {
      lessonId: "L1",
      title: "Example Lesson",
      isPublished: true,
      isFreePreview: false,
    },
  ];
}

export async function GET() {
  const lessons = await getLessonIndex();
  return NextResponse.json({ lessons }, { status: 200 });
}
