/**
 * Permanent Teacher Editor topic-identity regression gate.
 * Bank-facing Generate / Review / Attach must keep the persisted namespaced key.
 * @jest-environment node
 */
import { readFileSync } from "fs";
import path from "path";
import {
  persistentAiLessonDraftReviewTopicKey,
  resolveAiLessonDraftReviewTopicKey,
  splitTopicKeyForBankReview,
} from "./editLessonAiDraftReview";

const SPEC = "edexcel-igcse-biology";
const PRACTICAL_SLUG = "practical-investigating-anaerobic-respiration-in-yeast";
const PRACTICAL_NAMESPACED = `${SPEC}:${PRACTICAL_SLUG}`;
const RESPIRATION_ALIAS = `${SPEC}:respiration`;
const YEAST_SLUG = "yeast-in-food-production";
const YEAST_NAMESPACED = `${SPEC}:${YEAST_SLUG}`;
const LESSON_ID = "6ac23e3d782765bbef5acc65";

const practicalLesson = {
  persistedTopicKey: PRACTICAL_NAMESPACED,
  topicKey: RESPIRATION_ALIAS,
  specKey: SPEC,
  canonicalTopicKey: PRACTICAL_SLUG,
  title: "Practical: Investigating Anaerobic Respiration in Yeast",
};

const yeastLesson = {
  persistedTopicKey: YEAST_NAMESPACED,
  topicKey: YEAST_NAMESPACED,
  specKey: SPEC,
  canonicalTopicKey: YEAST_SLUG,
  title: "Yeast in Food Production",
};

function bankFacingIdentity(args: {
  topicKeyForBank?: string | null;
  sessionGenerateTopicKey?: string | null;
  persistedTopicKey?: string | null;
  lessonTopicKey?: string | null;
  lessonSpecKey?: string | null;
  lessonCanonicalTopicKey?: string | null;
}): { topicKey: string; specKey: string; topicKeySlug: string } {
  const topicKey = persistentAiLessonDraftReviewTopicKey({
    topicKeyForBank: args.topicKeyForBank,
    sessionGenerateTopicKey: args.sessionGenerateTopicKey,
    persistedTopicKey: args.persistedTopicKey,
    lessonTopicKey: args.lessonTopicKey,
    lessonSpecKey: args.lessonSpecKey,
    lessonCanonicalTopicKey: args.lessonCanonicalTopicKey,
  });
  if (!topicKey) {
    throw new Error("expected persisted bank-facing topic identity");
  }
  const parts = splitTopicKeyForBankReview(topicKey, args.lessonSpecKey);
  return { topicKey, specKey: parts.specKey, topicKeySlug: parts.topicKeySlug };
}

function practicalBankFacing(sessionGenerateTopicKey: string | null = RESPIRATION_ALIAS) {
  return bankFacingIdentity({
    topicKeyForBank: RESPIRATION_ALIAS,
    sessionGenerateTopicKey,
    persistedTopicKey: practicalLesson.persistedTopicKey,
    lessonTopicKey: practicalLesson.topicKey,
    lessonSpecKey: practicalLesson.specKey,
    lessonCanonicalTopicKey: practicalLesson.canonicalTopicKey,
  });
}

function yeastBankFacing() {
  return bankFacingIdentity({
    topicKeyForBank: YEAST_NAMESPACED,
    sessionGenerateTopicKey: YEAST_NAMESPACED,
    persistedTopicKey: yeastLesson.persistedTopicKey,
    lessonTopicKey: yeastLesson.topicKey,
    lessonSpecKey: yeastLesson.specKey,
    lessonCanonicalTopicKey: yeastLesson.canonicalTopicKey,
  });
}

function reviewUrl(which: "flashcards" | "quizzes" | "exam", identity: { specKey: string; topicKeySlug: string }) {
  const q = new URLSearchParams();
  q.set("topicKey", identity.topicKeySlug);
  q.set("specKey", identity.specKey);
  q.set("metadataSource", "ai_lesson_assets");
  q.set("lessonId", LESSON_ID);
  q.set("status", "draft");
  if (which === "exam") q.set("generationType", "exam");
  const pathName =
    which === "exam" ? "/teacher/exam-question-bank" : `/teacher/topic-banks/${which}`;
  return `${pathName}?${q.toString()}`;
}

describe("Teacher Editor persisted topic identity — Practical regression fixtures", () => {
  const editorSrc = readFileSync(path.join(__dirname, "EditLessonPage.tsx"), "utf8");
  const modalSrc = readFileSync(
    path.join(__dirname, "../components/lesson/AttachPageQuizModal.tsx"),
    "utf8"
  );
  const generateApiSrc = readFileSync(path.join(__dirname, "../api/lessons.ts"), "utf8");
  const normalizeSrc = readFileSync(
    path.join(__dirname, "../utils/normalizeLessonTopicKey.ts"),
    "utf8"
  );

  test("display/normalisation may still alias Practical to respiration without becoming bank-facing", () => {
    expect(PRACTICAL_SLUG.length).toBeGreaterThan(48);
    expect(normalizeSrc).toMatch(/if \(s\.length > 48\) return true;/);
    expect(normalizeSrc).toMatch(/if \(RESPIRATION_RE\.test\(t\)\) return "respiration";/);
    const bank = practicalBankFacing();
    expect(bank.topicKey).toBe(PRACTICAL_NAMESPACED);
    expect(bank.topicKey).not.toBe(RESPIRATION_ALIAS);
  });

  test("Generate AI assets: POST does not send a topicKey override", () => {
    expect(generateApiSrc).toMatch(
      /api\.post<GenerateLessonAssetsResult>\(`\/lessons\/\$\{lessonId\}\/generate-assets`, opts \?\? \{\}\)/
    );
    expect(editorSrc).toMatch(/generateLessonAssets\(id,/);
    expect(editorSrc).toMatch(/generateFlashcards: true/);
    expect(editorSrc).toMatch(/generateQuizQuestions: true/);
    expect(editorSrc).toMatch(/generateExamQuestions: includeExamInAiAssets/);
    expect(editorSrc).not.toMatch(/generateLessonAssets\(id,\s*\{[^}]*topicKey:/);
  });

  test("Generate AI assets: post-generate recount keeps persisted Practical identity over respiration session key", () => {
    const requestTopicKey = resolveAiLessonDraftReviewTopicKey(
      RESPIRATION_ALIAS,
      RESPIRATION_ALIAS,
      {
        persistedTopicKey: PRACTICAL_NAMESPACED,
        topicKey: RESPIRATION_ALIAS,
        specKey: SPEC,
        canonicalTopicKey: PRACTICAL_SLUG,
      }
    );
    expect(requestTopicKey).toBe(PRACTICAL_NAMESPACED);
    expect(requestTopicKey).not.toBe(RESPIRATION_ALIAS);
    expect(editorSrc).toMatch(/setAiGenerateTopicKey\(effectiveTopicKey\)/);
    expect(editorSrc).toMatch(/refreshAiLessonDraftCounts\(effectiveTopicKey\)/);
    expect(editorSrc).toMatch(
      /const topicKey = resolveAiLessonDraftReviewTopicKey\(\s*topicKeyForBank,/
    );
  });

  test("AI draft Review: flashcard, quiz, and exam counts/URLs use persisted Practical identity", () => {
    const identity = practicalBankFacing(null);
    expect(identity).toEqual({
      topicKey: PRACTICAL_NAMESPACED,
      specKey: SPEC,
      topicKeySlug: PRACTICAL_SLUG,
    });
    expect(identity.topicKey).not.toBe(RESPIRATION_ALIAS);

    const flashcards = reviewUrl("flashcards", identity);
    const quizzes = reviewUrl("quizzes", identity);
    const exam = reviewUrl("exam", identity);
    for (const url of [flashcards, quizzes, exam]) {
      const params = new URLSearchParams(url.split("?")[1]);
      expect(params.get("topicKey")).toBe(PRACTICAL_SLUG);
      expect(params.get("specKey")).toBe(SPEC);
      expect(params.get("topicKey")).not.toBe("respiration");
      expect(params.get("topicKey")).not.toBe(RESPIRATION_ALIAS);
      expect(url).not.toContain(encodeURIComponent(RESPIRATION_ALIAS));
    }

    expect(editorSrc).toMatch(/listTopicFlashcards\(\{/);
    expect(editorSrc).toMatch(/listTopicQuizQuestions\(topicKeySlug,/);
    expect(editorSrc).toMatch(/api\.get<\{ success\?: boolean; questions\?: unknown\[\] \}>\("\/exam-questions"/);
    expect(editorSrc).toMatch(/topicKeySlug: draftReviewUrlParts\.topicKeySlug/);
    expect(editorSrc).toMatch(/specKey: draftReviewUrlParts\.specKey/);
    expect(editorSrc).toMatch(
      /hasAiLessonDraftReviewToolbar && topicKeyForDraftReview && draftReviewUrlParts && id/
    );
  });

  test("AI draft Review: remount/session fallback does not replace Practical identity with respiration", () => {
    const remount = resolveAiLessonDraftReviewTopicKey(RESPIRATION_ALIAS, null, {
      persistedTopicKey: PRACTICAL_NAMESPACED,
      topicKey: RESPIRATION_ALIAS,
      specKey: SPEC,
      canonicalTopicKey: PRACTICAL_SLUG,
    });
    expect(remount).toBe(PRACTICAL_NAMESPACED);
    expect(remount).not.toBe(RESPIRATION_ALIAS);

    const noSession = practicalBankFacing(null);
    expect(noSession.topicKey).toBe(PRACTICAL_NAMESPACED);
    expect(noSession.topicKey).not.toBe(RESPIRATION_ALIAS);
  });

  test("Published Quiz Attach caller receives persisted Practical identity, never respiration", () => {
    const attach = practicalBankFacing();
    expect(attach.topicKey).toBe(PRACTICAL_NAMESPACED);
    expect(attach.topicKey).not.toBe(RESPIRATION_ALIAS);
    expect(editorSrc).toMatch(/topicKey=\{topicKeyForDraftReview \?\? ""\}/);
    expect(editorSrc).toMatch(/setAttachPageQuizModalMode\("published"\)/);
    expect(editorSrc).not.toMatch(/<AttachPageQuizModal[\s\S]*topicKey=\{topicKeyForBank/m);
    expect(modalSrc).toMatch(/exactMatch:\s*true/);
    expect(modalSrc).toMatch(/status:\s*"published"/);
  });

  test("AI Draft Quiz Attach uses the same Practical identity and Edexcel spec", () => {
    const attach = practicalBankFacing();
    expect(attach.topicKey).toBe(PRACTICAL_NAMESPACED);
    expect(attach.specKey).toBe(SPEC);
    expect(attach.topicKey).not.toBe(RESPIRATION_ALIAS);
    expect(editorSrc).toMatch(/specKey=\{draftReviewUrlParts\?\.specKey\}/);
    expect(editorSrc).toMatch(/setAttachPageQuizModalMode\("aiDrafts"\)/);
    expect(modalSrc).toMatch(/mode === "aiDrafts"/);
    expect(modalSrc).toMatch(/status:\s*"draft"/);
    expect(modalSrc).toMatch(/exactMatch:\s*true/);
  });

  test("short Yeast identity remains unchanged across Generate / Review / Attach resolution", () => {
    const yeast = yeastBankFacing();
    expect(yeast.topicKey).toBe(YEAST_NAMESPACED);
    expect(yeast.specKey).toBe(SPEC);
    expect(yeast.topicKeySlug).toBe(YEAST_SLUG);
    expect(yeast.topicKey).not.toBe(RESPIRATION_ALIAS);

    const generateRecount = resolveAiLessonDraftReviewTopicKey(
      YEAST_NAMESPACED,
      YEAST_NAMESPACED,
      {
        persistedTopicKey: YEAST_NAMESPACED,
        topicKey: YEAST_NAMESPACED,
        specKey: SPEC,
        canonicalTopicKey: YEAST_SLUG,
      }
    );
    expect(generateRecount).toBe(YEAST_NAMESPACED);
    expect(YEAST_SLUG.length).toBeLessThanOrEqual(48);
  });

  test("cross-feature invariant: Generate === Review === Published Attach === AI Draft Attach === persisted key", () => {
    const generateIdentity = resolveAiLessonDraftReviewTopicKey(
      RESPIRATION_ALIAS,
      RESPIRATION_ALIAS,
      practicalLesson
    );
    const reviewIdentity = resolveAiLessonDraftReviewTopicKey(RESPIRATION_ALIAS, null, practicalLesson);
    const publishedAttach = practicalBankFacing(RESPIRATION_ALIAS).topicKey;
    const aiDraftAttach = practicalBankFacing(RESPIRATION_ALIAS).topicKey;

    expect(generateIdentity).toBe(PRACTICAL_NAMESPACED);
    expect(reviewIdentity).toBe(PRACTICAL_NAMESPACED);
    expect(publishedAttach).toBe(PRACTICAL_NAMESPACED);
    expect(aiDraftAttach).toBe(PRACTICAL_NAMESPACED);
    expect(generateIdentity).toBe(reviewIdentity);
    expect(reviewIdentity).toBe(publishedAttach);
    expect(publishedAttach).toBe(aiDraftAttach);
    expect(aiDraftAttach).toBe(practicalLesson.persistedTopicKey);

    for (const requestTopicKey of [generateIdentity, reviewIdentity, publishedAttach, aiDraftAttach]) {
      expect(requestTopicKey).not.toBe(RESPIRATION_ALIAS);
      expect(requestTopicKey).toBe(PRACTICAL_NAMESPACED);
    }
  });
});
