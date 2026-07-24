/**
 * practiceAttempts API — payload shaping for linked vs frozen-set submit.
 */
import api from "../services/api";
import { submitPracticeAttempt } from "./practiceAttempts";

jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

const mockPost = api.post as jest.Mock;

describe("submitPracticeAttempt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: { ok: true } });
  });

  test("includes practiceSetId when provided", async () => {
    await submitPracticeAttempt({
      teacherId: "t1",
      practiceSetId: "set1",
      specKey: "aqa-gcse-biology",
      topicKey: "aqa-gcse-biology:cell-structure",
      contentType: "quiz_mcq",
      contentId: "c1",
      selectedChoiceIndex: 2,
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/practice-attempts",
      expect.objectContaining({
        practiceSetId: "set1",
        contentType: "quiz_mcq",
        contentId: "c1",
        selectedChoiceIndex: 2,
        teacherId: "t1",
      })
    );
  });

  test("does not send practiceSetId when absent", async () => {
    await submitPracticeAttempt({
      teacherId: "t1",
      specKey: "aqa-gcse-biology",
      topicKey: "aqa-gcse-biology:cell-structure",
      contentType: "exam_question",
      contentId: "c2",
      isCorrect: true,
    });

    const body = mockPost.mock.calls[0][1];
    expect(body).not.toHaveProperty("practiceSetId");
    expect(body.isCorrect).toBe(true);
  });
});
