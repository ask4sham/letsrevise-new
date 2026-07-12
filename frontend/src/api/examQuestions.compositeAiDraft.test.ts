/**
 * Unit-ish tests for generateCompositeQuestionDraft error mapping.
 * Mocks the shared api client reject shape { message, status, data }.
 */
import { generateCompositeQuestionDraft } from "./examQuestions";

jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

import api from "../services/api";

const mockedPost = api.post as jest.Mock;

describe("generateCompositeQuestionDraft error handling", () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  test("surfaces AI_DRAFT_INVALID from api client reject shape", async () => {
    mockedPost.mockRejectedValue({
      message: "AI draft failed validation.",
      status: 422,
      data: { success: false, msg: "AI draft failed validation.", code: "AI_DRAFT_INVALID", issues: ["total_marks_mismatch"] },
    });
    await expect(
      generateCompositeQuestionDraft({
        subject: "Biology",
        examBoard: "Edexcel",
        level: "IGCSE",
        topic: "Osmosis",
        topicKey: "t",
        difficulty: "easy",
      })
    ).rejects.toThrow(/AI draft failed validation/);
  });

  test("surfaces 404 endpoint missing clearly", async () => {
    mockedPost.mockRejectedValue({
      message: "Request failed with status code 404",
      status: 404,
      data: { msg: "API route not found" },
    });
    await expect(
      generateCompositeQuestionDraft({
        subject: "Biology",
        examBoard: "Edexcel",
        level: "IGCSE",
        topic: "Osmosis",
        topicKey: "t",
        difficulty: "hard",
      })
    ).rejects.toThrow(/not available on this server/i);
  });

  test("surfaces TOPIC_REQUIRED", async () => {
    mockedPost.mockRejectedValue({
      message: "Select a topic before generating.",
      status: 400,
      data: { success: false, msg: "Select a topic before generating.", code: "TOPIC_REQUIRED" },
    });
    await expect(
      generateCompositeQuestionDraft({
        subject: "Biology",
        examBoard: "Edexcel",
        level: "IGCSE",
        topic: "",
        topicKey: "",
        difficulty: "easy",
      })
    ).rejects.toThrow(/Select a topic before generating/);
  });
});
