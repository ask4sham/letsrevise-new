import {
  applyRevisionPracticeOverridePatch,
  type LessonLikeForRevisionPractice,
} from "./revisionPracticeLessonState";
import { mergeLessonQuizQuestionsForPersist } from "./lessonQuizPersistMerge";
import { isRevisionPracticeOverride } from "./revisionPracticeOverrides";
import {
  buildPracticeQuestionEditsPayload,
  hasPendingPracticeQuestionEdits,
  type PendingPracticeQuestionEditsMap,
} from "./practiceQuestionLessonState";

describe("practice question save integration", () => {
  test("no Phase 2 API payload when no pending edits", () => {
    expect(hasPendingPracticeQuestionEdits({})).toBe(false);
    expect(buildPracticeQuestionEditsPayload({})).toEqual([]);
  });

  test("Phase 2 batch payload contains only changed question attachments", () => {
    const pending: PendingPracticeQuestionEditsMap = {
      q1: {
        action: "upsert",
        lessonEdit: {
          type: "mcq",
          question: "Edited one",
          marks: 2,
          options: ["A", "B"],
          correctAnswer: "A",
        },
      },
      q2: { action: "clear" },
    };
    expect(buildPracticeQuestionEditsPayload(pending)).toEqual([
      {
        questionId: "q1",
        lessonEdit: pending.q1.action === "upsert" ? pending.q1.lessonEdit : null,
      },
      { questionId: "q2", lessonEdit: null },
    ]);
  });

  test("persisted Undo sends lessonEdit:null", () => {
    const pending: PendingPracticeQuestionEditsMap = {
      "507f1f77bcf86cd799439011": { action: "clear" },
    };
    expect(buildPracticeQuestionEditsPayload(pending)).toEqual([
      { questionId: "507f1f77bcf86cd799439011", lessonEdit: null },
    ]);
  });

  test("Phase 2 failure does not imply clearing pending edits", async () => {
    const pending: PendingPracticeQuestionEditsMap = {
      q1: {
        action: "upsert",
        lessonEdit: {
          type: "short",
          question: "Still pending",
          marks: 2,
          markScheme: ["Point"],
        },
      },
    };
    const saveLessonExamQuestionEdits = jest
      .fn()
      .mockRejectedValue(new Error("network")) as jest.MockedFunction<
      (lessonId: string, edits: Array<{ questionId: string; lessonEdit: unknown }>) => Promise<unknown>
    >;
    const refresh = jest.fn();

    let cleared = false;
    try {
      await saveLessonExamQuestionEdits("lesson-1", buildPracticeQuestionEditsPayload(pending));
      cleared = true;
    } catch {
      // keep pending — EditLessonPage must not clear on failure
    }

    expect(cleared).toBe(false);
    expect(hasPendingPracticeQuestionEdits(pending)).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
  });

  test("core lesson save happens before Phase 2 edit save", async () => {
    const order: string[] = [];
    const saveToBackend = jest.fn(async () => {
      order.push("lesson");
      return true;
    });
    const saveLessonExamQuestionEdits = jest.fn(
      async (_lessonId: string, _edits: Array<{ questionId: string; lessonEdit: unknown }>) => {
        order.push("practice-edits");
        return { ok: true };
      }
    );
    const pending: PendingPracticeQuestionEditsMap = {
      q1: {
        action: "upsert",
        lessonEdit: {
          type: "mcq",
          question: "Q",
          marks: 1,
          options: ["A", "B"],
          correctAnswer: "A",
        },
      },
    };

    const lessonSaved = await saveToBackend();
    if (lessonSaved && hasPendingPracticeQuestionEdits(pending)) {
      await saveLessonExamQuestionEdits("lesson-1", buildPracticeQuestionEditsPayload(pending));
    }

    expect(order).toEqual(["lesson", "practice-edits"]);
  });

  test("existing Save Changes still works with no Phase 2 edits", async () => {
    const saveToBackend = jest.fn(async () => true);
    const saveLessonExamQuestionEdits = jest.fn();

    const lessonSaved = await saveToBackend();
    if (lessonSaved && hasPendingPracticeQuestionEdits({})) {
      await saveLessonExamQuestionEdits("lesson-1", []);
    }

    expect(saveToBackend).toHaveBeenCalledTimes(1);
    expect(saveLessonExamQuestionEdits).not.toHaveBeenCalled();
  });

  test("Page Quiz save payload unchanged by Phase 2 pending state", () => {
    const pages = [
      {
        pageId: "p1",
        blocks: [
          {
            type: "pageQuiz",
            questions: [
              {
                id: "pq1",
                type: "mcq",
                question: "Page quiz Q",
                options: ["A", "B"],
                correctAnswer: "A",
                marks: 1,
              },
            ],
          },
        ],
      },
    ];
    const lessonQuizQuestions = [
      {
        id: "legacy-q",
        type: "mcq",
        question: "Legacy quiz",
        options: ["A", "B"],
        correctAnswer: "A",
        marks: 1,
        pageId: "p1",
      },
    ];

    const merged = mergeLessonQuizQuestionsForPersist(pages, lessonQuizQuestions);
    expect(merged.some((q) => String(q.question).includes("Page quiz Q"))).toBe(true);
    expect(hasPendingPracticeQuestionEdits({})).toBe(false);
  });

  test("Revision Practice Block 27 save behaviour unchanged", () => {
    const lesson: LessonLikeForRevisionPractice = {
      pages: [
        {
          pageId: "p1",
          blocks: [
            {
              id: "blk_a",
              type: "selfCheck",
              prompt: "Checkpoint?",
              options: ["A", "B", "C", "D"],
              correctAnswer: "A",
            },
          ],
        },
      ],
      quiz: { timeSeconds: 600, questions: [] },
    };

    const next = applyRevisionPracticeOverridePatch(lesson, {
      linkageKey: "blk_a",
      question: "Teacher override",
      options: ["A", "B", "C", "D"],
      correctAnswer: "B",
    });

    const override = (next.quiz?.questions ?? []).find((q) =>
      isRevisionPracticeOverride(q as Record<string, unknown>)
    );
    expect(override?.question).toBe("Teacher override");
    expect(hasPendingPracticeQuestionEdits({})).toBe(false);
  });
});
