/**
 * Canonical lesson readiness evaluator (frontend).
 * PR-READINESS-AUTO-ATTACH-LABELS-1: labels show source (auto-attached vs manual).
 */
export type LessonReadiness = {
  minimumPublishable: boolean;
  classroomReady: boolean;
  checks: { key: string; label: string; pass: boolean; note?: string }[];
  counts: { pages: number; diagrams: number; checkpoints: number; quizQuestions: number; flashcards: number; practiceAttached: number; misconceptions: number };
};
type LessonBlock = { type?: string; content?: unknown; text?: unknown; prompt?: unknown };
function hasImageInBlock(block: any): boolean {
  if (!block || typeof block !== "object") return false;
  const content = block.content ?? block.text ?? "";
  if (typeof content === "string" && /!\[.*?\]\(.*?\)|https?:\/\/[^\s)]+\.(jpg|jpeg|png|gif|webp)/i.test(content)) return true;
  return !!(block.source ?? block.url);
}
export function evaluateLessonReadiness(lesson: any): LessonReadiness {
  const blocks: LessonBlock[] = (lesson?.pages ?? []).flatMap((p: any) => (p?.blocks ?? [])).filter(Boolean);
  const pages = lesson?.pages ?? [];
  const pagesCount = Array.isArray(pages) ? pages.length : 0;
  const diagramsCount = blocks.filter((b) => (b.type && String(b.type).toLowerCase().includes("diagram")) || hasImageInBlock(b)).length;
  const checkpointsCount = blocks.filter((b) => b.type && String(b.type).toLowerCase().includes("checkpoint")).length;
  const misconceptionsCount = blocks.filter((b) => b.type && String(b.type).toLowerCase().includes("misconception")).length;
  const quizQuestions = lesson?.quiz?.questions ?? [];
  const quizQuestionsCount = Array.isArray(quizQuestions) ? quizQuestions.length : 0;
  const quizHasAuto = Array.isArray(quizQuestions) && quizQuestions.some((q: any) => Array.isArray(q?.tags) && q.tags.includes("auto-attached"));
  const flashcardsRaw = lesson?.flashcards ?? lesson?.revision?.flashcards;
  const flashcardsCount = Array.isArray(flashcardsRaw) ? flashcardsRaw.length : 0;
  const flashcardsHaveAuto = Array.isArray(flashcardsRaw) && flashcardsRaw.some((fc: any) => fc && typeof fc === "object" && Array.isArray(fc.tags) && fc.tags.includes("auto-attached"));
  const practiceAttached = lesson?.practiceQuestionsAttachedCount ?? lesson?.readiness?.signals?.practiceCount ?? 0;
  const topicKey = lesson?.topicKey ?? lesson?.topic;
  const hasTopic = typeof topicKey === "string" && topicKey.trim().length > 0;
  const reviewed = lesson?.reviewed === true || lesson?.reviewedAt != null || lesson?.readiness?.reviewed === true || lesson?.readiness?.signals?.isReviewed === true;
  const contentBlockCount = blocks.filter((b) => { const content = (b.content ?? b.text ?? b.prompt ?? "").toString().trim(); return content.length > 0; }).length;
  const bankExists = !!(lesson?.readiness?.signals as any)?.hasPracticeQuestions;
  const counts = { pages: pagesCount, diagrams: diagramsCount, checkpoints: checkpointsCount, quizQuestions: quizQuestionsCount, flashcards: flashcardsCount, practiceAttached: typeof practiceAttached === "number" ? practiceAttached : 0, misconceptions: misconceptionsCount };
  const quizLabel = quizQuestionsCount === 0 ? "Quiz missing" : quizHasAuto ? "Quiz present (auto-attached)" : "Quiz present";
  const flashcardsLabel = flashcardsCount === 0 ? "Flashcards missing" : flashcardsHaveAuto ? "Flashcards present (auto-attached)" : "Flashcards present";
  const checks: LessonReadiness["checks"] = [
    { key: "pages", label: "At least 1 page", pass: pagesCount >= 1 },
    { key: "content", label: "At least 1 content block", pass: contentBlockCount >= 1 },
    { key: "quiz", label: quizLabel, pass: quizQuestionsCount >= 3 },
    { key: "flashcards", label: flashcardsLabel, pass: flashcardsCount >= 10 },
    { key: "topic", label: "Topic set", pass: hasTopic },
    { key: "reviewed", label: "Marked as reviewed", pass: reviewed },
    { key: "checkpoints", label: "At least 1 checkpoint (classroom)", pass: checkpointsCount >= 1 },
    { key: "misconceptions", label: "At least 1 misconception (classroom)", pass: misconceptionsCount >= 1 },
    { key: "diagrams", label: "At least 1 diagram (classroom)", pass: diagramsCount >= 1 },
    { key: "practice", label: "At least 10 practice attached or bank (classroom)", pass: counts.practiceAttached >= 10 || bankExists },
  ];
  const minimumPublishable = pagesCount >= 1 && contentBlockCount >= 1 && quizQuestionsCount >= 3 && flashcardsCount >= 10 && hasTopic && reviewed;
  const classroomReady = minimumPublishable && checkpointsCount >= 1 && misconceptionsCount >= 1 && diagramsCount >= 1 && (counts.practiceAttached >= 10 || bankExists);
  return { minimumPublishable, classroomReady, checks, counts };
}
export {};
