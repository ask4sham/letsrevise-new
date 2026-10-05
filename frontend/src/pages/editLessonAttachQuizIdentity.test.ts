/**
 * Teacher Editor Attach quiz identity — must reuse AI Review persistent identity.
 * @jest-environment node
 */
import { readFileSync } from "fs";
import path from "path";
import {
  resolveAiLessonDraftReviewTopicKey,
  splitTopicKeyForBankReview,
} from "./editLessonAiDraftReview";

const YEAST_NAMESPACED = "edexcel-igcse-biology:yeast-in-food-production";
const PRACTICAL_SLUG = "practical-investigating-anaerobic-respiration-in-yeast";
const PRACTICAL_NAMESPACED = `edexcel-igcse-biology:${PRACTICAL_SLUG}`;
const RESPIRATION_ALIAS = "edexcel-igcse-biology:respiration";

function attachIdentityFromReview(args: {
  topicKeyForBank?: string | null;
  persistedTopicKey?: string | null;
  lessonTopicKey?: string | null;
  lessonSpecKey?: string | null;
  lessonCanonicalTopicKey?: string | null;
}): { topicKey: string; specKey: string } | null {
  const topicKey = resolveAiLessonDraftReviewTopicKey(args.topicKeyForBank, null, {
    persistedTopicKey: args.persistedTopicKey,
    topicKey: args.lessonTopicKey,
    specKey: args.lessonSpecKey,
    canonicalTopicKey: args.lessonCanonicalTopicKey,
  });
  if (!topicKey) return null;
  const parts = splitTopicKeyForBankReview(topicKey, args.lessonSpecKey);
  return { topicKey, specKey: parts.specKey };
}

describe("EditLessonPage Attach quiz identity", () => {
  const editorSrc = readFileSync(path.join(__dirname, "EditLessonPage.tsx"), "utf8");
  const modalSrc = readFileSync(
    path.join(__dirname, "../components/lesson/AttachPageQuizModal.tsx"),
    "utf8"
  );

  test("long Practical persisted identity wins over respiration alias", () => {
    const attach = attachIdentityFromReview({
      topicKeyForBank: RESPIRATION_ALIAS,
      persistedTopicKey: PRACTICAL_NAMESPACED,
      lessonTopicKey: RESPIRATION_ALIAS,
      lessonSpecKey: "edexcel-igcse-biology",
      lessonCanonicalTopicKey: PRACTICAL_SLUG,
    });
    expect(attach).toEqual({
      topicKey: PRACTICAL_NAMESPACED,
      specKey: "edexcel-igcse-biology",
    });
    expect(attach?.topicKey).not.toBe(RESPIRATION_ALIAS);
  });

  test("correct Edexcel spec is derived from the namespaced persistent key", () => {
    const attach = attachIdentityFromReview({
      persistedTopicKey: PRACTICAL_NAMESPACED,
      topicKeyForBank: RESPIRATION_ALIAS,
      lessonSpecKey: "edexcel-igcse-biology",
    });
    expect(attach?.specKey).toBe("edexcel-igcse-biology");
    const parts = splitTopicKeyForBankReview(attach!.topicKey, "aqa-gcse-biology");
    expect(parts.specKey).toBe("edexcel-igcse-biology");
    expect(parts.topicKeySlug).toBe(PRACTICAL_SLUG);
  });

  test("short Yeast identity remains unchanged", () => {
    expect(
      attachIdentityFromReview({
        topicKeyForBank: YEAST_NAMESPACED,
        persistedTopicKey: YEAST_NAMESPACED,
        lessonTopicKey: YEAST_NAMESPACED,
        lessonSpecKey: "edexcel-igcse-biology",
        lessonCanonicalTopicKey: "yeast-in-food-production",
      })
    ).toEqual({
      topicKey: YEAST_NAMESPACED,
      specKey: "edexcel-igcse-biology",
    });
  });

  test("missing persistent identity prevents modal open", () => {
    expect(attachIdentityFromReview({})).toBeNull();
    expect(editorSrc).toMatch(/if \(!topicKeyForDraftReview\) return;/);
    expect(editorSrc).toMatch(/disabled=\{!topicKeyForDraftReview\}/);
    expect(editorSrc).toMatch(/disabled=\{!topicKeyForDraftReview \|\| !id\}/);
    expect(editorSrc).not.toMatch(/disabled=\{!topicKeyForBank\}/);
    expect(editorSrc).not.toMatch(/disabled=\{!topicKeyForBank \|\| !id\}/);
  });

  test("published and AI-draft Attach modes use identical resolved topic identity", () => {
    expect(editorSrc).toMatch(/topicKey=\{topicKeyForDraftReview \?\? ""\}/);
    expect(editorSrc).toMatch(/specKey=\{draftReviewUrlParts\?\.specKey\}/);
    expect(editorSrc).not.toMatch(/<AttachPageQuizModal[\s\S]*topicKey=\{topicKeyForBank/m);
    expect(editorSrc).toMatch(/mode=\{attachPageQuizModalMode\}/);
    expect(modalSrc).toMatch(/exactMatch:\s*true/);
    expect(modalSrc).toMatch(/mode === "aiDrafts"/);
    expect(modalSrc).toMatch(/status:\s*"published"/);
  });

  test("existing AI Review identity behaviour remains unchanged in the editor", () => {
    expect(editorSrc).toMatch(/hasAiLessonDraftReviewToolbar && topicKeyForDraftReview && draftReviewUrlParts && id/);
    expect(editorSrc).toMatch(/topicKeySlug: draftReviewUrlParts\.topicKeySlug/);
    expect(editorSrc).toMatch(/specKey: draftReviewUrlParts\.specKey/);
    expect(editorSrc).not.toMatch(
      /hasAiLessonDraftReviewToolbar && topicKeyForBank && id/
    );
  });
});
