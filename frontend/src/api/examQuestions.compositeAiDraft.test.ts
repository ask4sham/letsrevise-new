/**
 * Unit-ish tests for generateCompositeQuestionDraft error mapping.
 * Mocks the shared api client reject shape { message, status, data }.
 */
import { generateCompositeQuestionDraft, generateCompositeDataTableQuestionDraft } from "./examQuestions";

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

describe("generateCompositeDataTableQuestionDraft", () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  test("calls data-table endpoint", async () => {
    mockedPost.mockResolvedValue({
      data: {
        success: true,
        draft: {
          title: "T",
          sharedStem: "A student investigated enzyme activity carefully.",
          difficulty: "easy",
          questionStyle: "data_table",
          totalMarks: 3,
          dataTable: {
            columns: [
              { heading: "T", unit: "°C" },
              { heading: "R", unit: "s⁻¹" },
            ],
            rows: [
              ["20", "1"],
              ["30", "2"],
              ["40", "3"],
            ],
          },
          parts: [],
        },
      },
    });
    await generateCompositeDataTableQuestionDraft({
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Enzymes",
      topicKey: "enzymes",
      difficulty: "easy",
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/exam-questions/ai-draft-composite-data-table",
      expect.objectContaining({ topicKey: "enzymes", difficulty: "easy" })
    );
  });

  test("teacher-friendly error for invalid data-table draft; keeps issue codes in non-production", async () => {
    const env = process.env as { NODE_ENV?: string };
    const prev = env.NODE_ENV;
    env.NODE_ENV = "development";
    try {
      mockedPost.mockRejectedValue({
        message: "AI data-table draft failed validation.",
        status: 422,
        data: {
          success: false,
          msg: "AI data-table draft failed validation.",
          code: "AI_DRAFT_INVALID",
          issues: ["data_table_row_count:2_expected_3-6"],
        },
      });
      await expect(
        generateCompositeDataTableQuestionDraft({
          subject: "Biology",
          examBoard: "Edexcel",
          level: "IGCSE",
          topic: "Osmosis",
          topicKey: "t",
          difficulty: "medium",
        })
      ).rejects.toThrow(/AI generated an invalid data table\. Please try again/);
      await expect(
        generateCompositeDataTableQuestionDraft({
          subject: "Biology",
          examBoard: "Edexcel",
          level: "IGCSE",
          topic: "Osmosis",
          topicKey: "t",
          difficulty: "medium",
        })
      ).rejects.toThrow(/data_table_row_count/);
    } finally {
      env.NODE_ENV = prev;
    }
  });

  test("successful repaired response is returned to caller", async () => {
    mockedPost.mockResolvedValue({
      data: {
        success: true,
        draft: {
          title: "Repaired enzyme table",
          sharedStem: "A student investigated enzyme activity carefully.",
          difficulty: "medium",
          questionStyle: "data_table",
          totalMarks: 5,
          dataTable: {
            columns: [
              { heading: "Temperature", unit: "°C" },
              { heading: "Rate", unit: "s⁻¹" },
            ],
            rows: [
              ["20", "0.01"],
              ["30", "0.02"],
              ["40", "0.03"],
              ["50", "0.015"],
            ],
          },
          parts: [
            {
              label: "a",
              type: "short",
              marks: 1,
              questionText: "State the temperature with the highest rate.",
              markSchemeLines: ["Award 1 mark for 40 °C."],
            },
          ],
        },
      },
    });
    const draft = await generateCompositeDataTableQuestionDraft({
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Enzymes",
      topicKey: "enzymes",
      difficulty: "medium",
    });
    expect(draft.dataTable?.rows).toHaveLength(4);
    expect(draft.questionStyle).toBe("data_table");
  });
});
