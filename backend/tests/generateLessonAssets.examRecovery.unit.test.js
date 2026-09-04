/**
 * Caller regression: generateLessonAssets surfaces mark-scheme recovery outcomes.
 */
jest.mock("../services/generateFlashcardsFromLesson", () => ({
  generateFlashcardsFromLesson: jest.fn().mockResolvedValue([]),
}));
jest.mock("../services/generateQuizQuestionsFromLesson", () => ({
  generateQuizQuestionsFromLesson: jest.fn().mockResolvedValue([]),
}));
jest.mock("../services/generateExamQuestionsFromLesson", () => ({
  generateExamQuestionsFromLesson: jest.fn(),
}));
jest.mock("../utils/lessonAssetLlm", () => ({
  callOpenAiJson: jest.fn(),
}));

const ExamQuestion = require("../models/ExamQuestion");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const { generateExamQuestionsFromLesson } = require("../services/generateExamQuestionsFromLesson");
const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const { generateLessonAssets } = require("../services/generateLessonAssets");

const lessonDoc = {
  _id: "64bfa1c765e15e080aee9ad0",
  teacherId: "64bfa1c765e15e080aee9ad1",
  title: "Osmosis lesson",
  description: "A long enough lesson description about osmosis in plant cells for asset generation tests.",
  content: "Osmosis is the movement of water molecules from a dilute solution to a more concentrated solution through a partially permeable membrane.",
  subject: "Biology",
  board: "AQA",
  level: "GCSE",
  specKey: "aqa-gcse-biology",
  topicKey: "aqa-gcse-biology:cell-structure",
  topic: "Cell structure",
  subTopic: "Cell structure",
  pages: [
    {
      pageId: "p1",
      title: "Osmosis",
      blocks: [
        {
          type: "text",
          content:
            "When plant cells are placed in a concentrated solution, water leaves by osmosis and the cytoplasm shrinks.",
        },
      ],
    },
  ],
  updatedAt: new Date(),
};

const validDraft = {
  type: "short",
  question: "Explain how osmosis affects plant cells in a concentrated solution.",
  marks: 4,
  commandWord: "Explain",
  markScheme: [
    "Water moves out of the cell by osmosis.",
    "The cytoplasm shrinks and the cell becomes plasmolysed.",
    "The cell membrane pulls away from the cell wall.",
    "Turgor pressure is lost in the plant cell.",
  ],
  modelAnswer:
    "Water leaves the cell by osmosis, so the cytoplasm shrinks and the membrane pulls away from the cell wall.",
};

const mismatchedDraft = {
  ...validDraft,
  markScheme: ["Water moves out of the cell by osmosis.", "The cytoplasm shrinks and the cell becomes plasmolysed."],
};

function chainLean(value) {
  return {
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe("generateLessonAssets exam recovery callers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(TopicFlashcard, "find").mockReturnValue(chainLean([]));
    jest.spyOn(TopicFlashcard, "deleteMany").mockResolvedValue({ deletedCount: 0 });
    jest.spyOn(TopicQuizQuestion, "find").mockReturnValue(chainLean([]));
    jest.spyOn(TopicQuizQuestion, "deleteMany").mockResolvedValue({ deletedCount: 0 });
    jest.spyOn(ExamQuestion, "find").mockImplementation((query) => {
      if (query.fingerprint) {
        return chainLean(null);
      }
      return chainLean([]);
    });
    jest.spyOn(ExamQuestion, "deleteMany").mockResolvedValue({ deletedCount: 0 });
    jest.spyOn(ExamQuestion, "create").mockResolvedValue({ _id: "eq-created" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("exhausted corrective retry returns partial status with incompleteRecoveryFailures", async () => {
    generateExamQuestionsFromLesson.mockResolvedValue([mismatchedDraft]);
    callOpenAiJson.mockResolvedValue(mismatchedDraft);

    const out = await generateLessonAssets({
      lesson: lessonDoc,
      ownerId: "64bfa1c765e15e080aee9ad1",
      generateFlashcards: false,
      generateQuizQuestions: false,
      generateExamQuestions: true,
    });

    expect(out.status).toBe("partial");
    expect(out.generated.examQuestions).toBe(0);
    expect(out.examQuestionStats.incompleteRecoveryFailures).toBe(1);
    expect(out.errors.some((e) => e.code === "GENERATED_EXAM_QUESTION_SET_INCOMPLETE")).toBe(true);
    expect(ExamQuestion.create).not.toHaveBeenCalled();
    expect(callOpenAiJson).toHaveBeenCalledTimes(1);
  });

  test("successful corrective retry persists exam draft normally", async () => {
    generateExamQuestionsFromLesson.mockResolvedValue([mismatchedDraft]);
    callOpenAiJson.mockResolvedValue(validDraft);

    const out = await generateLessonAssets({
      lesson: lessonDoc,
      ownerId: "64bfa1c765e15e080aee9ad1",
      generateFlashcards: false,
      generateQuizQuestions: false,
      generateExamQuestions: true,
    });

    expect(out.status).toBe("ok");
    expect(out.generated.examQuestions).toBe(1);
    expect(out.examQuestionStats.incompleteRecoveryFailures).toBe(0);
    expect(ExamQuestion.create).toHaveBeenCalledTimes(1);
    expect(callOpenAiJson).toHaveBeenCalledTimes(1);
  });
});
