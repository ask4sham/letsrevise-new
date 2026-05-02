import { NextResponse } from "next/server";
import { deterministicAutoFixLesson } from "@/lib/deterministicAutoFixLesson";
import { parseLessonText } from "@/lib/parseLessonText";
import { validateLessonOutput } from "@/lib/validateLessonOutput";

export async function POST(req) {
  try {
    const body = await req.json();
    const draft = body.draft || body.originalLesson || "";
    const subject = body.subject || "Biology";
    const keyStage = body.keyStage || "KS4 - GCSE";
    const examBoard = body.examBoard || "AQA";
    const topic = body.topic ?? "";

    if (!draft.trim()) {
      return NextResponse.json(
        { error: "Missing draft lesson text." },
        { status: 400 }
      );
    }

    const { text, fixesApplied } = deterministicAutoFixLesson({
      text: draft,
      subject,
      keyStage,
      examBoard,
      topic,
    });

    const blocks = parseLessonText(text);
    const validation = validateLessonOutput(blocks, text);

    return NextResponse.json({
      text,
      fixesApplied,
      validation,
    });
  } catch (error) {
    console.error("deterministic autofix error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to auto-fix lesson." },
      { status: 500 }
    );
  }
}
