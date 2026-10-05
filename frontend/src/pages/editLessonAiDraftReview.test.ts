/**
 * Teacher Editor AI draft review links — persistent namespaced identity vs session counts.
 * @jest-environment node
 */
import {
  countFromSettledList,
  hasAiLessonDraftReviewToolbar,
  pendingDraftsFromSettledLists,
  persistentAiLessonDraftReviewTopicKey,
  resolveAiLessonDraftReviewTopicKey,
  shouldShowAiLessonDraftReviewLink,
  splitTopicKeyForBankReview,
} from "./editLessonAiDraftReview";

const MONGO_ID = "6a1c7b28e2b056a760772243";
const isMongoObjectId = (id: string) => /^[a-f0-9]{24}$/i.test(id);

const YEAST_NAMESPACED = "edexcel-igcse-biology:yeast-in-food-production";
const PRACTICAL_SLUG = "practical-investigating-anaerobic-respiration-in-yeast";
const PRACTICAL_NAMESPACED = `edexcel-igcse-biology:${PRACTICAL_SLUG}`;

const generated860 = { flashcards: 8, quizQuestions: 6, examQuestions: 0 };
const generated8610 = { flashcards: 8, quizQuestions: 6, examQuestions: 10 };
const liveZero = { flashcards: 0, quizQuestions: 0, examQuestions: 0 };
const live860 = { flashcards: 8, quizQuestions: 6, examQuestions: 0 };
const live8610 = { flashcards: 8, quizQuestions: 6, examQuestions: 10 };

function listCandidates(specKey: string, topicKeySlug: string): string[] {
  return [`${specKey}:${topicKeySlug}`, topicKeySlug];
}

describe("resolveAiLessonDraftReviewTopicKey", () => {
  test("prefers live topicKeyForBank when present and lesson identity is absent", () => {
    expect(
      resolveAiLessonDraftReviewTopicKey("aqa-gcse-biology:photosynthesis", "edexcel-igcse-biology:other")
    ).toBe("aqa-gcse-biology:photosynthesis");
  });

  test("falls back to session generate topic key when topicKeyForBank is absent", () => {
    expect(resolveAiLessonDraftReviewTopicKey(null, "aqa-gcse-biology:photosynthesis")).toBe(
      "aqa-gcse-biology:photosynthesis"
    );
    expect(resolveAiLessonDraftReviewTopicKey("", "aqa-gcse-biology:photosynthesis")).toBe(
      "aqa-gcse-biology:photosynthesis"
    );
  });

  test("returns null when both keys are missing", () => {
    expect(resolveAiLessonDraftReviewTopicKey(null, null)).toBeNull();
  });
});

describe("shouldShowAiLessonDraftReviewLink", () => {
  test("8 flashcards / 6 quiz / 0 exam: flashcard and quiz links show; exam stays hidden", () => {
    expect(shouldShowAiLessonDraftReviewLink(0, 8)).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(0, 6)).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(0, 0)).toBe(false);
  });

  test("8 / 6 / 10: all three Review links", () => {
    expect(shouldShowAiLessonDraftReviewLink(0, generated8610.flashcards)).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(0, generated8610.quizQuestions)).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(0, generated8610.examQuestions)).toBe(true);
  });

  test("live pending counts still show links when session generated is empty", () => {
    expect(shouldShowAiLessonDraftReviewLink(8, 0)).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(6, null)).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(0, undefined)).toBe(false);
  });
});

describe("hasAiLessonDraftReviewToolbar", () => {
  test("session 8/6/0 with missing topicKeyForBank but effectiveTopicKey: toolbar can render", () => {
    const topicKey = resolveAiLessonDraftReviewTopicKey(null, "aqa-gcse-biology:photosynthesis");
    expect(
      hasAiLessonDraftReviewToolbar({
        topicKey,
        lessonId: MONGO_ID,
        isMongoObjectId,
        pendingDrafts: liveZero,
        lastGenerated: generated860,
      })
    ).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(0, generated860.flashcards)).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(0, generated860.quizQuestions)).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(0, generated860.examQuestions)).toBe(false);
  });

  test("live pending counts render toolbar without session generated", () => {
    expect(
      hasAiLessonDraftReviewToolbar({
        topicKey: "aqa-gcse-biology:photosynthesis",
        lessonId: MONGO_ID,
        isMongoObjectId,
        pendingDrafts: live860,
        lastGenerated: null,
      })
    ).toBe(true);
  });

  test("does not invent exam link when both live and generated exam counts are 0", () => {
    expect(shouldShowAiLessonDraftReviewLink(live860.examQuestions, generated860.examQuestions)).toBe(
      false
    );
  });

  test("toolbar stays hidden without a topic key even if generate counts exist", () => {
    expect(
      hasAiLessonDraftReviewToolbar({
        topicKey: null,
        lessonId: MONGO_ID,
        isMongoObjectId,
        pendingDrafts: liveZero,
        lastGenerated: generated860,
      })
    ).toBe(false);
  });
});

describe("pendingDraftsFromSettledLists", () => {
  test("one failed list request does not suppress successful counts from the others", () => {
    const flashcards: PromiseSettledResult<unknown[]> = {
      status: "fulfilled",
      value: new Array(8),
    };
    const quiz: PromiseSettledResult<unknown[]> = {
      status: "fulfilled",
      value: new Array(6),
    };
    const exam: PromiseSettledResult<unknown[]> = {
      status: "rejected",
      reason: new Error("exam list failed"),
    };
    expect(pendingDraftsFromSettledLists({ flashcards, quiz, exam })).toEqual({
      flashcards: 8,
      quizQuestions: 6,
      examQuestions: 0,
    });
    expect(countFromSettledList(exam)).toBe(0);
  });

  test("flashcard failure does not zero a successful quiz count", () => {
    expect(
      pendingDraftsFromSettledLists({
        flashcards: { status: "rejected", reason: new Error("fc") },
        quiz: { status: "fulfilled", value: new Array(6) },
        exam: { status: "fulfilled", value: [] },
      })
    ).toEqual({ flashcards: 0, quizQuestions: 6, examQuestions: 0 });
  });
});

describe("persistent namespaced review identity", () => {
  test("Yeast in Food Production persisted namespaced identity still works", () => {
    const topicKey = persistentAiLessonDraftReviewTopicKey({
      topicKeyForBank: YEAST_NAMESPACED,
      persistedTopicKey: YEAST_NAMESPACED,
      lessonTopicKey: YEAST_NAMESPACED,
      lessonSpecKey: "edexcel-igcse-biology",
      lessonCanonicalTopicKey: "yeast-in-food-production",
    });
    expect(topicKey).toBe(YEAST_NAMESPACED);
    const parts = splitTopicKeyForBankReview(topicKey!, "edexcel-igcse-biology");
    expect(parts).toEqual({
      specKey: "edexcel-igcse-biology",
      topicKeySlug: "yeast-in-food-production",
    });
    expect(listCandidates(parts.specKey, parts.topicKeySlug)).toContain(YEAST_NAMESPACED);
  });

  test("long valid persisted namespaced key outranks a shorter frontend alias", () => {
    expect(PRACTICAL_SLUG.length).toBeGreaterThan(48);
    expect(
      persistentAiLessonDraftReviewTopicKey({
        persistedTopicKey: PRACTICAL_NAMESPACED,
        lessonTopicKey: "edexcel-igcse-biology:respiration",
        topicKeyForBank: "edexcel-igcse-biology:respiration",
        sessionGenerateTopicKey: "edexcel-igcse-biology:respiration",
        lessonSpecKey: "edexcel-igcse-biology",
        lessonCanonicalTopicKey: PRACTICAL_SLUG,
      })
    ).toBe(PRACTICAL_NAMESPACED);
  });

  test("Practical anaerobic yeast: generation and review identity are the same namespaced key", () => {
    expect(PRACTICAL_SLUG.length).toBeGreaterThan(48);
    const generated = PRACTICAL_NAMESPACED;
    const review = persistentAiLessonDraftReviewTopicKey({
      topicKeyForBank: "edexcel-igcse-biology:respiration",
      sessionGenerateTopicKey: null,
      persistedTopicKey: PRACTICAL_NAMESPACED,
      lessonTopicKey: "edexcel-igcse-biology:respiration",
      lessonSpecKey: "edexcel-igcse-biology",
      lessonCanonicalTopicKey: PRACTICAL_SLUG,
    });
    expect(review).toBe(generated);
    const parts = splitTopicKeyForBankReview(review!);
    expect(parts).toEqual({
      specKey: "edexcel-igcse-biology",
      topicKeySlug: PRACTICAL_SLUG,
    });
    expect(listCandidates(parts.specKey, parts.topicKeySlug)).toContain(generated);
  });

  test("canonicalTopicKey still restores Practical identity when persisted GET key is absent", () => {
    const review = resolveAiLessonDraftReviewTopicKey(
      "edexcel-igcse-biology:respiration",
      null,
      {
        topicKey: "edexcel-igcse-biology:respiration",
        specKey: "edexcel-igcse-biology",
        canonicalTopicKey: PRACTICAL_SLUG,
      }
    );
    expect(review).toBe(PRACTICAL_NAMESPACED);
  });

  test("AQA localStorage/default cannot override an Edexcel namespaced lesson key", () => {
    const storedAqaDefault = "aqa-gcse-biology";
    const review = persistentAiLessonDraftReviewTopicKey({
      topicKeyForBank: "edexcel-igcse-biology:respiration",
      persistedTopicKey: PRACTICAL_NAMESPACED,
      lessonTopicKey: "edexcel-igcse-biology:respiration",
      lessonSpecKey: "edexcel-igcse-biology",
      lessonCanonicalTopicKey: PRACTICAL_SLUG,
    });
    const parts = splitTopicKeyForBankReview(review!, storedAqaDefault);
    expect(parts.specKey).toBe("edexcel-igcse-biology");
    expect(parts.specKey).not.toBe(storedAqaDefault);
    expect(parts.topicKeySlug).toBe(PRACTICAL_SLUG);
    expect(listCandidates(parts.specKey, parts.topicKeySlug)).toContain(PRACTICAL_NAMESPACED);
    expect(listCandidates(parts.specKey, parts.topicKeySlug)).not.toContain(
      `aqa-gcse-biology:${PRACTICAL_SLUG}`
    );
  });

  test("remount: session lastGenerated gone; live recount + persisted key restores Review links", () => {
    const topicKey = persistentAiLessonDraftReviewTopicKey({
      topicKeyForBank: "edexcel-igcse-biology:respiration",
      sessionGenerateTopicKey: null,
      persistedTopicKey: PRACTICAL_NAMESPACED,
      lessonTopicKey: "edexcel-igcse-biology:respiration",
      lessonSpecKey: "edexcel-igcse-biology",
      lessonCanonicalTopicKey: PRACTICAL_SLUG,
    });
    const parts = splitTopicKeyForBankReview(topicKey!, "aqa-gcse-biology");
    expect(parts).toEqual({
      specKey: "edexcel-igcse-biology",
      topicKeySlug: PRACTICAL_SLUG,
    });
    expect(
      hasAiLessonDraftReviewToolbar({
        topicKey,
        lessonId: MONGO_ID,
        isMongoObjectId,
        pendingDrafts: live8610,
        lastGenerated: null,
      })
    ).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(live8610.flashcards, undefined)).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(live8610.quizQuestions, undefined)).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(live8610.examQuestions, undefined)).toBe(true);
  });

  test("8/6/0 still renders only Flashcard + Quiz after persisted identity restore", () => {
    const topicKey = persistentAiLessonDraftReviewTopicKey({
      persistedTopicKey: PRACTICAL_NAMESPACED,
      lessonTopicKey: "edexcel-igcse-biology:respiration",
      lessonSpecKey: "edexcel-igcse-biology",
      lessonCanonicalTopicKey: PRACTICAL_SLUG,
    });
    expect(
      hasAiLessonDraftReviewToolbar({
        topicKey,
        lessonId: MONGO_ID,
        isMongoObjectId,
        pendingDrafts: live860,
        lastGenerated: null,
      })
    ).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(live860.flashcards, undefined)).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(live860.quizQuestions, undefined)).toBe(true);
    expect(shouldShowAiLessonDraftReviewLink(live860.examQuestions, undefined)).toBe(false);
  });

  test("exam bank retrieval uses generated namespaced identity rather than an empty AQA $in", () => {
    const review = persistentAiLessonDraftReviewTopicKey({
      persistedTopicKey: PRACTICAL_NAMESPACED,
      lessonTopicKey: "edexcel-igcse-biology:respiration",
      lessonSpecKey: "edexcel-igcse-biology",
      lessonCanonicalTopicKey: PRACTICAL_SLUG,
    });
    const parts = splitTopicKeyForBankReview(review!, "aqa-gcse-biology");
    const candidates = listCandidates(parts.specKey, parts.topicKeySlug);
    expect(candidates).toContain(PRACTICAL_NAMESPACED);
    expect(candidates).not.toEqual([`aqa-gcse-biology:${PRACTICAL_SLUG}`, PRACTICAL_SLUG]);
  });

  test("does not hard-code lesson titles or an Edexcel-only branch", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "editLessonAiDraftReview.ts"),
      "utf8"
    ) as string;
    expect(src).not.toMatch(/Yeast in Food Production/);
    expect(src).not.toMatch(/Investigating Anaerobic/);
    expect(src).not.toMatch(/edexcel-igcse-biology/);
    expect(src).not.toMatch(/getStoredSpecKey/);
  });
});

describe("splitTopicKeyForBankReview", () => {
  test("splits namespaced generate topic key for review URLs", () => {
    expect(splitTopicKeyForBankReview("aqa-gcse-biology:photosynthesis")).toEqual({
      specKey: "aqa-gcse-biology",
      topicKeySlug: "photosynthesis",
    });
  });
});

describe("EditLessonPage review-link wiring", () => {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const src = fs.readFileSync(path.join(__dirname, "EditLessonPage.tsx"), "utf8");

  test("retains effectiveTopicKey and uses session generate counts for review links", () => {
    expect(src).toMatch(/setAiGenerateTopicKey\(effectiveTopicKey\)/);
    expect(src).toMatch(/refreshAiLessonDraftCounts\(effectiveTopicKey\)/);
    expect(src).toMatch(/shouldShowAiLessonDraftReviewLink/);
    expect(src).toMatch(/Promise\.allSettled/);
    expect(src).toMatch(/topicKeyForDraftReview/);
    expect(src).not.toMatch(/hasAiLessonDraftReviewToolbar && topicKeyForBank && id/);
  });

  test("persistent review identity uses lesson fields and does not pass getStoredSpecKey into split", () => {
    expect(src).toMatch(/persistedTopicKey: lesson\?\.persistedTopicKey/);
    expect(src).toMatch(/persistedTopicKey: lessonForTopicNorm\.topicKey/);
    expect(src).toMatch(/canonicalTopicKey: lesson\?\.canonicalTopicKey/);
    expect(src).not.toMatch(
      /splitTopicKeyForBankReview\(\s*topicKeyForDraftReview,\s*\(lesson as \{ specKey\?: string \}\)\?\.specKey \|\| getStoredSpecKey\(\)/
    );
  });

  test("does not change generate-assets POST contract", () => {
    expect(src).toMatch(/generateLessonAssets\(id,/);
    expect(src).toMatch(/generateFlashcards: true/);
    expect(src).toMatch(/generateQuizQuestions: true/);
    expect(src).toMatch(/generateExamQuestions: includeExamInAiAssets/);
  });
});
