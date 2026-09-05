import type { PracticeQuestionAttachment } from "../api/lessonPracticeEdits";
import {
  applyPracticeQuestionFieldPatch,
  buildPracticeQuestionEditsPayload,
  buildPracticeQuestionTabLabels,
  getDisplayEffective,
  isPracticeAttachmentShownToStudents,
  validatePendingPracticeQuestionEditsForSave,
} from "./practiceQuestionLessonState";

const LINE1 = "The mutation is present in a gamete.";
const LINE2 =
  "If that gamete takes part in fertilisation, the altered DNA can enter the zygote and be inherited by the offspring.";
const NEW_LINE1 = "The mutation is present in the DNA of a gamete.";

const shortAttachment: PracticeQuestionAttachment = {
  questionId: "short-1",
  slotIndex: 1,
  editable: true,
  hasLessonEdit: false,
  available: true,
  master: {
    id: "short-1",
    question: "Explain why a mutation in a gamete can be inherited by offspring.",
    type: "short",
    marks: 2,
    markScheme: [LINE1, LINE2],
    correctAnswer:
      "The mutation is in a gamete, so if that gamete fertilises an egg, the offspring inherits the altered DNA.",
    explanation: "Hidden explanation",
  },
  effective: {
    id: "short-1",
    question: "Explain why a mutation in a gamete can be inherited by offspring.",
    type: "short",
    marks: 2,
    markScheme: [LINE1, LINE2],
    correctAnswer:
      "The mutation is in a gamete, so if that gamete fertilises an egg, the offspring inherits the altered DNA.",
    explanation: "Hidden explanation",
  },
  lessonEdit: null,
};

describe("practiceQuestionLessonState short markScheme", () => {
  test("transient empty row 1 preserves two slots and indices", () => {
    const afterClear = applyPracticeQuestionFieldPatch(shortAttachment, undefined, {
      markScheme: ["", LINE2],
    });

    expect(afterClear.markScheme).toEqual(["", LINE2]);

    const pendingClear = { action: "upsert" as const, lessonEdit: afterClear };
    expect(getDisplayEffective(shortAttachment, pendingClear)?.markScheme).toEqual(["", LINE2]);
  });

  test("browser replace sequence keeps both mark points through save payload", () => {
    const afterClear = applyPracticeQuestionFieldPatch(shortAttachment, undefined, {
      markScheme: ["", LINE2],
    });
    const pendingClear = { action: "upsert" as const, lessonEdit: afterClear };

    const afterType = applyPracticeQuestionFieldPatch(shortAttachment, pendingClear, {
      markScheme: [NEW_LINE1, LINE2],
    });
    expect(afterType.markScheme).toEqual([NEW_LINE1, LINE2]);

    const pendingFinal = { action: "upsert" as const, lessonEdit: afterType };
    expect(getDisplayEffective(shortAttachment, pendingFinal)?.markScheme).toEqual([
      NEW_LINE1,
      LINE2,
    ]);

    expect(validatePendingPracticeQuestionEditsForSave({ [shortAttachment.questionId]: pendingFinal })).toBeNull();

    const sent = buildPracticeQuestionEditsPayload({ [shortAttachment.questionId]: pendingFinal });
    expect(sent[0].lessonEdit?.markScheme).toEqual([NEW_LINE1, LINE2]);
  });

  test("explicit remove mark point reduces array length", () => {
    const afterRemove = applyPracticeQuestionFieldPatch(shortAttachment, undefined, {
      markScheme: [LINE2],
    });
    expect(afterRemove.markScheme).toEqual([LINE2]);
  });

  test("editing question preserves hidden model answer and explanation", () => {
    const payload = applyPracticeQuestionFieldPatch(shortAttachment, undefined, {
      markScheme: [NEW_LINE1, LINE2],
    });
    expect(payload.correctAnswer).toBe(shortAttachment.effective?.correctAnswer);
    expect(payload.explanation).toBe("Hidden explanation");
  });

  test("save blocked while a mark scheme row is still empty", () => {
    const pending = {
      action: "upsert" as const,
      lessonEdit: applyPracticeQuestionFieldPatch(shortAttachment, undefined, {
        markScheme: ["", LINE2],
      }),
    };
    expect(validatePendingPracticeQuestionEditsForSave({ [shortAttachment.questionId]: pending })).toMatch(
      /mark scheme point needs text/i
    );
  });

  test("save blocked when marks do not match markScheme length", () => {
    const pending = {
      action: "upsert" as const,
      lessonEdit: applyPracticeQuestionFieldPatch(shortAttachment, undefined, {
        marks: 4,
        markScheme: [LINE1, LINE2],
      }),
    };
    expect(validatePendingPracticeQuestionEditsForSave({ [shortAttachment.questionId]: pending })).toMatch(
      /worth 4 marks/i
    );
  });

  test("legacy mismatched short opens with full data, blocks save until aligned, then saves", () => {
    const legacyMismatch: PracticeQuestionAttachment = {
      ...shortAttachment,
      questionId: "legacy-mismatch",
      master: {
        ...shortAttachment.master!,
        id: "legacy-mismatch",
        marks: 4,
        markScheme: [LINE1, LINE2],
      },
      effective: {
        ...shortAttachment.effective!,
        id: "legacy-mismatch",
        marks: 4,
        markScheme: [LINE1, LINE2],
      },
    };

    const opened = getDisplayEffective(legacyMismatch, undefined);
    expect(opened?.marks).toBe(4);
    expect(opened?.markScheme).toEqual([LINE1, LINE2]);
    expect(opened?.question).toBe(shortAttachment.master!.question);

    const blocked = validatePendingPracticeQuestionEditsForSave({
      [legacyMismatch.questionId]: {
        action: "upsert",
        lessonEdit: applyPracticeQuestionFieldPatch(legacyMismatch, undefined, {}),
      },
    });
    expect(blocked).toMatch(/worth 4 marks/i);

    const withExtraPoints = applyPracticeQuestionFieldPatch(legacyMismatch, undefined, {
      markScheme: [LINE1, LINE2, "Third mark point for legacy alignment.", "Fourth mark point for legacy alignment."],
    });
    expect(withExtraPoints.marks).toBe(4);
    expect(withExtraPoints.markScheme).toHaveLength(4);

    const pendingAligned = { action: "upsert" as const, lessonEdit: withExtraPoints };
    expect(validatePendingPracticeQuestionEditsForSave({ [legacyMismatch.questionId]: pendingAligned })).toBeNull();
    expect(buildPracticeQuestionEditsPayload({ [legacyMismatch.questionId]: pendingAligned })[0].lessonEdit?.markScheme).toHaveLength(4);
  });
});

const mcqVisible: PracticeQuestionAttachment = {
  questionId: "mcq-visible",
  slotIndex: 0,
  editable: true,
  hasLessonEdit: false,
  available: true,
  master: {
    id: "mcq-visible",
    question: "Visible MCQ?",
    type: "mcq",
    marks: 1,
    options: ["A", "B"],
    correctAnswer: "A",
  },
  effective: {
    id: "mcq-visible",
    question: "Visible MCQ?",
    type: "mcq",
    marks: 1,
    options: ["A", "B"],
    correctAnswer: "A",
  },
  lessonEdit: null,
};

const unavailableAttachment: PracticeQuestionAttachment = {
  questionId: "missing-1",
  slotIndex: 0,
  editable: false,
  unsupportedReason: "Question unavailable — remove from lesson",
  hasLessonEdit: false,
  available: false,
  master: null,
  effective: null,
  lessonEdit: null,
};

const bankManagedAttachment: PracticeQuestionAttachment = {
  questionId: "composite-1",
  slotIndex: 0,
  editable: false,
  unsupportedReason: "This question type is managed in the Question Bank.",
  hasLessonEdit: false,
  available: true,
  master: {
    id: "composite-1",
    question: "Composite stem",
    type: "composite",
    marks: 4,
  },
  effective: {
    id: "composite-1",
    question: "Composite stem",
    type: "composite",
    marks: 4,
  },
  lessonEdit: null,
};

describe("practiceQuestionLessonState tab labels", () => {
  test("available:false labels tab Unavailable, not Not shown", () => {
    const labels = buildPracticeQuestionTabLabels([unavailableAttachment]);
    expect(labels[0].label).toBe("Q1 · Unavailable");
    expect(labels[0].label).not.toMatch(/Not shown/i);
    expect(labels[0].studentNumber).toBeNull();
    expect(labels[0].shownToStudents).toBe(false);
  });

  test("available:true and student-visible uses normal or student-number tab", () => {
    const labels = buildPracticeQuestionTabLabels([mcqVisible, shortAttachment]);
    expect(labels[0].label).toBe("Q1");
    expect(labels[1].label).toBe("Q2");
    expect(labels[0].shownToStudents).toBe(true);
    expect(labels[0].studentNumber).toBe(1);
    expect(unavailableAttachment.available).toBe(false);
    expect(mcqVisible.available).toBe(true);
    expect(mcqVisible.editable).toBe(true);
  });

  test("available:true but not student-visible labels tab Not shown", () => {
    const labels = buildPracticeQuestionTabLabels([bankManagedAttachment]);
    expect(labels[0].label).toBe("Q1 · Not shown");
    expect(labels[0].shownToStudents).toBe(false);
    expect(isPracticeAttachmentShownToStudents(bankManagedAttachment)).toBe(false);
  });

  test("unavailable attachment does not consume a student-visible number", () => {
    const labels = buildPracticeQuestionTabLabels([
      unavailableAttachment,
      mcqVisible,
      shortAttachment,
    ]);
    expect(labels[0].label).toBe("Q1 · Unavailable");
    expect(labels[1].label).toBe("Q2 · Student Q1");
    expect(labels[2].label).toBe("Q3 · Student Q2");
    expect(labels[0].studentNumber).toBeNull();
    expect(labels[1].studentNumber).toBe(1);
    expect(labels[2].studentNumber).toBe(2);
  });

  test("numbering helper does not mutate attachment availability", () => {
    const attachments = [unavailableAttachment, mcqVisible, bankManagedAttachment];
    const before = attachments.map((a) => ({
      available: a.available,
      editable: a.editable,
      unsupportedReason: a.unsupportedReason,
    }));
    buildPracticeQuestionTabLabels(attachments);
    expect(
      attachments.map((a) => ({
        available: a.available,
        editable: a.editable,
        unsupportedReason: a.unsupportedReason,
      }))
    ).toEqual(before);
  });
});
