/**
 * Unit tests for attachExamQuestionsByTopic sandbox exclusion (no DB).
 */
const { attachExamQuestionsByTopic } = require("../utils/attachExamQuestionsByTopic");

jest.mock("../models/ExamQuestion", () => ({
  find: jest.fn(),
}));

jest.mock("../models/Lesson", () => ({
  findById: jest.fn(),
}));

const ExamQuestion = require("../models/ExamQuestion");
const Lesson = require("../models/Lesson");

function mockFindChain(docs) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(docs),
  };
  ExamQuestion.find.mockReturnValue(chain);
  return chain;
}

describe("attachExamQuestionsByTopic sandbox exclusion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("query excludes metadata.sandboxManualTest true (disposable sandbox masters)", async () => {
    const teacherId = "507f1f77bcf86cd799439011";
    const legitId = "507f1f77bcf86cd799439012";
    const lessonId = "507f1f77bcf86cd799439014";

    mockFindChain([{ _id: legitId, marks: 1, createdAt: new Date() }]);

    Lesson.findById.mockResolvedValue({
      _id: lessonId,
      examQuestions: [],
      save: jest.fn().mockResolvedValue(undefined),
    });

    const lesson = {
      _id: lessonId,
      teacherId,
      topic: "Mutation",
      topicKey: "edexcel-igcse-biology:mutation",
      specKey: "edexcel-igcse-biology",
      examQuestions: [],
    };

    await attachExamQuestionsByTopic(lesson, {
      topicKey: "edexcel-igcse-biology:mutation",
      limit: 5,
    });

    expect(ExamQuestion.find).toHaveBeenCalledWith(
      expect.objectContaining({
        topicKey: expect.objectContaining({
          $in: expect.arrayContaining(["edexcel-igcse-biology:mutation"]),
        }),
        type: { $in: ["mcq", "short"] },
        "metadata.sandboxManualTest": { $ne: true },
      })
    );
  });

  test("selects a normal eligible question with the same topicKey", async () => {
    const teacherId = "507f1f77bcf86cd799439021";
    const legitId = "507f1f77bcf86cd799439022";
    const lessonId = "507f1f77bcf86cd799439024";

    mockFindChain([{ _id: legitId, marks: 3, createdAt: new Date() }]);

    Lesson.findById.mockResolvedValue({
      _id: lessonId,
      examQuestions: [],
      save: jest.fn().mockResolvedValue(undefined),
    });

    const lesson = {
      _id: lessonId,
      teacherId,
      topic: "Mutation",
      topicKey: "edexcel-igcse-biology:mutation",
      specKey: "edexcel-igcse-biology",
      examQuestions: [],
    };

    const result = await attachExamQuestionsByTopic(lesson, {
      topicKey: "edexcel-igcse-biology:mutation",
      limit: 1,
    });

    expect(result.added).toBe(1);
    expect(result.addedIds).toEqual([legitId]);
  });
});
