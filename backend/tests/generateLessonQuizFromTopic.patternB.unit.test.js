/**
 * Ensures generateLessonQuizFromTopic queries the bank using resolveQuestionBankNamespacedTopicKey result.
 */
jest.mock("../models/Lesson");
jest.mock("../models/TopicQuizQuestion");
jest.mock("../utils/topicKey", () => {
  const actual = jest.requireActual("../utils/topicKey");
  return {
    ...actual,
    queryCandidates: jest.fn(() => []),
  };
});
jest.mock("../utils/resolveTopicRuntimeKeys", () => ({
  resolveQuestionBankNamespacedTopicKey: jest.fn(() => "aqa-gcse-biology:digestive-system"),
}));

const Lesson = require("../models/Lesson");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const { resolveQuestionBankNamespacedTopicKey } = require("../utils/resolveTopicRuntimeKeys");
const { generateLessonQuizFromTopic } = require("../services/generateLessonQuizFromTopic");

describe("generateLessonQuizFromTopic Pattern B", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveQuestionBankNamespacedTopicKey.mockReturnValue("aqa-gcse-biology:digestive-system");
  });

  test("find uses bank namespace from resolveQuestionBankNamespacedTopicKey when candidates empty", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    Lesson.findById.mockResolvedValue({
      teacherId: "t1",
      specKey: "aqa-gcse-biology",
      topicKey: "aqa-gcse-biology:stomach-custom",
      quiz: { questions: [] },
      markModified: jest.fn(),
      save,
      toObject: () => ({}),
    });

    const sort = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    TopicQuizQuestion.find.mockReturnValue({ sort });

    await generateLessonQuizFromTopic({ lessonId: "x", userId: "u" });

    expect(resolveQuestionBankNamespacedTopicKey).toHaveBeenCalledWith(
      "aqa-gcse-biology",
      "aqa-gcse-biology:stomach-custom"
    );
    expect(TopicQuizQuestion.find).toHaveBeenCalled();
    const arg = TopicQuizQuestion.find.mock.calls[0][0];
    expect(arg.topicKey).toBe("aqa-gcse-biology:digestive-system");
  });
});
