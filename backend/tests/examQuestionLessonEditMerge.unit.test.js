const {
  mergeExamQuestionForPractice,
  mapMasterToPracticeShape,
} = require("../utils/mergeExamQuestionLessonEdit");
const { validateExamQuestionLessonEdit } = require("../utils/validateExamQuestionLessonEdit");

describe("mergeExamQuestionLessonEdit", () => {
  const masterMcq = {
    _id: "507f1f77bcf86cd799439011",
    question: "Master MCQ?",
    type: "mcq",
    marks: 2,
    options: ["A", "B", "C"],
    correctIndex: 0,
    markScheme: ["Because A"],
    topicKey: "cells",
    topic: "Cells",
  };

  const masterShort = {
    _id: "507f1f77bcf86cd799439012",
    question: "Master short?",
    type: "short",
    marks: 3,
    markScheme: ["Point A", "Point B", "Point C"],
    correctAnswer: "Model",
    topicKey: "cells",
  };

  test("returns master shape when no lessonEdit", () => {
    const out = mergeExamQuestionForPractice(masterMcq, { questionId: masterMcq._id });
    expect(out.id).toBe(masterMcq._id);
    expect(out.question).toBe("Master MCQ?");
    expect(out.options).toEqual(["A", "B", "C"]);
    expect(out.correctAnswer).toBe("A");
    expect(out.marks).toBe(2);
  });

  test("overlays lessonEdit while retaining master id and metadata", () => {
    const attachment = {
      questionId: masterMcq._id,
      lessonEdit: {
        type: "mcq",
        question: "Lesson MCQ?",
        marks: 4,
        options: ["X", "Y", "Z"],
        correctAnswer: "Z",
        correctIndex: 2,
        markScheme: ["Z is right"],
        editedAt: new Date(),
      },
    };
    const out = mergeExamQuestionForPractice(masterMcq, attachment);
    expect(out.id).toBe(masterMcq._id);
    expect(out.question).toBe("Lesson MCQ?");
    expect(out.marks).toBe(4);
    expect(out.options).toEqual(["X", "Y", "Z"]);
    expect(out.correctAnswer).toBe("Z");
    expect(out.type).toBe("mcq");
    expect(out.topicKey).toBe("cells");
  });

  test("effective type remains master type", () => {
    const attachment = {
      questionId: masterShort._id,
      lessonEdit: {
        type: "short",
        question: "Edited short",
        marks: 2,
        markScheme: ["New scheme one", "New scheme two"],
        editedAt: new Date(),
      },
    };
    const out = mergeExamQuestionForPractice(masterShort, attachment);
    expect(out.type).toBe("short");
    expect(out.markScheme).toEqual(["New scheme one", "New scheme two"]);
  });

  test("missing master with lessonEdit uses snapshot", () => {
    const attachment = {
      questionId: masterMcq._id,
      lessonEdit: {
        type: "mcq",
        question: "Orphan edit",
        marks: 1,
        options: ["P", "Q"],
        correctAnswer: "P",
        correctIndex: 0,
        editedAt: new Date(),
      },
    };
    const out = mergeExamQuestionForPractice(null, attachment);
    expect(out.id).toBe(masterMcq._id);
    expect(out.question).toBe("Orphan edit");
  });

  test("missing master without lessonEdit returns null", () => {
    expect(mergeExamQuestionForPractice(null, { questionId: masterMcq._id })).toBeNull();
  });

  test("mapMasterToPracticeShape matches legacy fields", () => {
    const out = mapMasterToPracticeShape(masterMcq);
    expect(out.type).toBe("mcq");
    expect(out.correctAnswer).toBe("A");
  });
});

describe("validateExamQuestionLessonEdit", () => {
  const masterMcq = {
    _id: "507f1f77bcf86cd799439011",
    type: "mcq",
    question: "Q?",
    marks: 2,
    options: ["A", "B"],
    correctIndex: 0,
  };

  const masterShort = {
    _id: "507f1f77bcf86cd799439012",
    type: "short",
    question: "Q?",
    marks: 2,
    markScheme: ["A", "B"],
  };

  test("rejects unsupported master composite type", () => {
    expect(() =>
      validateExamQuestionLessonEdit(
        { _id: "1", type: "composite", question: "C?" },
        { type: "composite", question: "X", marks: 1 }
      )
    ).toThrow(/cannot be edited/i);
  });

  test("rejects MCQ to short conversion", () => {
    expect(() =>
      validateExamQuestionLessonEdit(masterMcq, {
        type: "short",
        question: "Converted?",
        marks: 2,
        markScheme: ["x"],
      })
    ).toThrow(/must match master type/i);
  });

  test("rejects short to MCQ conversion", () => {
    expect(() =>
      validateExamQuestionLessonEdit(masterShort, {
        type: "mcq",
        question: "Converted?",
        marks: 2,
        options: ["A", "B"],
        correctAnswer: "A",
      })
    ).toThrow(/must match master type/i);
  });

  test("accepts valid MCQ lessonEdit and derives correctIndex", () => {
    const out = validateExamQuestionLessonEdit(masterMcq, {
      type: "mcq",
      question: "Edited?",
      marks: 3,
      options: ["One", "Two", "Three"],
      correctAnswer: "Two",
    });
    expect(out.type).toBe("mcq");
    expect(out.correctIndex).toBe(1);
    expect(out.marks).toBe(3);
  });

  test("accepts valid short lessonEdit", () => {
    const out = validateExamQuestionLessonEdit(masterShort, {
      type: "short",
      question: "Edited short?",
      marks: 4,
      markScheme: ["Line 1", "Line 2", "Line 3", "Line 4"],
    });
    expect(out.markScheme).toEqual(["Line 1", "Line 2", "Line 3", "Line 4"]);
  });

  test("rejects short lessonEdit when marks do not match markScheme length", () => {
    expect(() =>
      validateExamQuestionLessonEdit(masterShort, {
        type: "short",
        question: "Edited short?",
        marks: 4,
        markScheme: ["Line 1", "Line 2"],
      })
    ).toThrow(/exactly 4 mark-scheme points/i);
  });

  test("null input clears lessonEdit", () => {
    expect(validateExamQuestionLessonEdit(masterMcq, null)).toBeNull();
  });
});
