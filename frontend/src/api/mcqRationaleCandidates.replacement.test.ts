import {
  createMcqRationaleReplacementIdempotencyKey,
  generateReplacementMcqRationaleCandidate,
} from "./mcqRationaleCandidates";
import api from "../services/api";

jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

describe("mcqRationaleCandidates replacement client", () => {
  const mockedPost = api.post as unknown as jest.Mock;

  beforeEach(() => {
    mockedPost.mockReset();
  });

  test("posts dedicated replacement endpoint with bounded payload", async () => {
    mockedPost.mockResolvedValue({
      data: { candidate: { candidateId: "c2", attemptNumber: 2 }, replayed: false },
    });
    await generateReplacementMcqRationaleCandidate({
      rejectedCandidateId: "c1",
      questionId: "qid123",
      partLabel: "a",
      expectedSourceFingerprint: "b".repeat(64),
      idempotencyKey: "mcq-rationale-replacement:c1:qid123:a:fp",
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/admin/exam-question-rationale-candidates/c1/replacement",
      {
        questionId: "qid123",
        partLabel: "a",
        expectedSourceFingerprint: "b".repeat(64),
        idempotencyKey: "mcq-rationale-replacement:c1:qid123:a:fp",
      }
    );
    const body = mockedPost.mock.calls[0][1];
    expect(body).not.toHaveProperty("attemptNumber");
    expect(body).not.toHaveProperty("generationGroupKey");
    expect(body).not.toHaveProperty("status");
  });

  test("replacement idempotency key is deterministic and hashed when long", () => {
    const longPart = "part-label-with-spaces and symbols!".repeat(3);
    const key = createMcqRationaleReplacementIdempotencyKey({
      rejectedCandidateId: "507f1f77bcf86cd799439011",
      questionId: "507f191e810c19729de860ea",
      partLabel: longPart,
      sourceFingerprint: "d".repeat(64),
    });
    const again = createMcqRationaleReplacementIdempotencyKey({
      rejectedCandidateId: "507f1f77bcf86cd799439011",
      questionId: "507f191e810c19729de860ea",
      partLabel: longPart,
      sourceFingerprint: "d".repeat(64),
    });
    expect(key).toBe(again);
    expect(key.length).toBeLessThanOrEqual(128);
    expect(key).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
    expect(key.startsWith("mcq-rationale-replacement:")).toBe(true);
  });
});
