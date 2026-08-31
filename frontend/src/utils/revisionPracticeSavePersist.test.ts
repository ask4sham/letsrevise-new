import { buildEditorSlots } from "../components/lesson/RevisionPracticeEditor";
import { mergeLessonQuizQuestionsForPersist } from "./lessonQuizPersistMerge";
import { buildRevisionPracticePool } from "./lessonQuestionPools";
import {
  REVISION_PRACTICE_OVERRIDE_SOURCE_TYPE,
  isRevisionPracticeOverride,
} from "./revisionPracticeOverrides";
import {
  applyRevisionPracticeOverridePatch,
  type LessonLikeForRevisionPractice,
} from "./revisionPracticeLessonState";

const mutationPages = () => [
  {
    pageId: "p1",
    blocks: [
      {
        type: "selfCheck",
        prompt: "What is a mutation in terms of genetic material?",
        options: [
          "A change in DNA sequence",
          "A type of cell division",
          "A protein fold",
          "A lipid layer",
        ],
        correctAnswer: "A change in DNA sequence",
      },
    ],
  },
];

const teacherPatch = {
  sourcePageId: "p1",
  sourceBlockIndex: 0,
  question: "Which option best describes a teacher-edited mutation?",
  options: [
    "A change in DNA sequence",
    "A type of cell division",
    "A protein fold",
    "A lipid layer",
  ],
  correctAnswer: "A change in DNA sequence",
  explanation: "Teacher explanation",
};

function firstOverride(lesson: LessonLikeForRevisionPractice) {
  return (lesson.quiz?.questions ?? []).find((q) =>
    isRevisionPracticeOverride(q as Record<string, unknown>)
  );
}

describe("revision practice save persist boundary", () => {
  test("first teacher edit assigns block.id and one override atomically", () => {
    const lesson: LessonLikeForRevisionPractice = {
      pages: mutationPages(),
      quiz: { timeSeconds: 600, questions: [] },
    };

    const next = applyRevisionPracticeOverridePatch(lesson, teacherPatch);
    const block = (next.pages?.[0]?.blocks?.[0] ?? {}) as { id?: string };

    expect(block.id).toMatch(/^blk_/);
    expect(next.quiz?.questions).toHaveLength(1);

    const override = firstOverride(next);
    expect(override).toBeDefined();
    expect(override!.sourceType).toBe(REVISION_PRACTICE_OVERRIDE_SOURCE_TYPE);
    expect(override!.sourceQuestionId).toBe(block.id);
    expect(override!.tags).toEqual(expect.arrayContaining(["revision-practice", "teacher-override"]));
    expect(override!.question).toBe(teacherPatch.question);
    expect(override!.pageId).toBeUndefined();
  });

  test("getLessonPersistPayload merge includes revisionPracticeOverride", () => {
    const next = applyRevisionPracticeOverridePatch(
      { pages: mutationPages(), quiz: { timeSeconds: 600, questions: [] } },
      teacherPatch
    );
    const blockId = String(
      ((next.pages?.[0]?.blocks?.[0] ?? {}) as { id?: string }).id ?? ""
    );

    const payloadQuestions = mergeLessonQuizQuestionsForPersist(
      next.pages ?? [],
      next.quiz?.questions ?? []
    );

    const overrides = payloadQuestions.filter((q) =>
      isRevisionPracticeOverride(q as Record<string, unknown>)
    );
    expect(overrides).toHaveLength(1);
    expect(overrides[0].sourceQuestionId).toBe(blockId);
    expect(overrides[0].question).toBe(teacherPatch.question);
  });

  test("reload simulation recognises override and suppresses generated variant", () => {
    const next = applyRevisionPracticeOverridePatch(
      { pages: mutationPages(), quiz: { timeSeconds: 600, questions: [] } },
      teacherPatch
    );

    const pool = buildRevisionPracticePool(next.pages ?? [], next.quiz?.questions ?? [], 5);
    expect(pool).toHaveLength(1);
    expect(pool[0].question).toBe(teacherPatch.question);

    const slots = buildEditorSlots(next.pages ?? [], next.quiz?.questions ?? [], 5);
    expect(slots).toHaveLength(1);
    expect(slots[0].isOverride).toBe(true);
    expect(slots[0].question).toBe(teacherPatch.question);
    expect(slots[0].isGenerated).toBe(false);
  });

  test("second edit updates same override without duplicate or linkage change", () => {
    let lesson = applyRevisionPracticeOverridePatch(
      { pages: mutationPages(), quiz: { timeSeconds: 600, questions: [] } },
      teacherPatch
    );
    const blockId = String(
      ((lesson.pages?.[0]?.blocks?.[0] ?? {}) as { id?: string }).id ?? ""
    );
    const overrideId = firstOverride(lesson)!.id;

    lesson = applyRevisionPracticeOverridePatch(lesson, {
      linkageKey: blockId,
      existingOverrideId: overrideId,
      question: "Teacher mutation revision — edited again?",
      options: teacherPatch.options,
      correctAnswer: teacherPatch.correctAnswer,
    });

    expect(lesson.quiz?.questions).toHaveLength(1);
    expect(firstOverride(lesson)!.sourceQuestionId).toBe(blockId);
    expect(firstOverride(lesson)!.question).toBe("Teacher mutation revision — edited again?");

    const payloadOnce = mergeLessonQuizQuestionsForPersist(
      lesson.pages ?? [],
      lesson.quiz?.questions ?? []
    );
    const payloadTwice = mergeLessonQuizQuestionsForPersist(
      lesson.pages ?? [],
      lesson.quiz?.questions ?? []
    );

    const countOverrides = (qs: typeof payloadOnce) =>
      qs.filter((q) => isRevisionPracticeOverride(q as Record<string, unknown>)).length;

    expect(countOverrides(payloadOnce)).toBe(1);
    expect(countOverrides(payloadTwice)).toBe(1);
  });
});
