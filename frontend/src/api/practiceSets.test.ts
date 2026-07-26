/**
 * practiceSets API — getPracticeSet by ID (resume) + class membership generate.
 */
import api from "../services/api";
import { generatePracticeSet, getPracticeSet } from "./practiceSets";

jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockGet = api.get as jest.Mock;
const mockPost = api.post as jest.Mock;

describe("getPracticeSet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GETs /practice-sets/:id and returns body including teacherId", async () => {
    const body = {
      practiceSetId: "abc",
      items: [],
      selectedCount: 5,
      teacherId: "teacher1",
      lessonId: "lesson1",
    };
    mockGet.mockResolvedValue({ data: body });

    const res = await getPracticeSet("abc");

    expect(mockGet).toHaveBeenCalledWith("/practice-sets/abc");
    expect(res).toEqual(body);
    expect(res.teacherId).toBe("teacher1");
  });

  test("encodes practiceSetId in path", async () => {
    mockGet.mockResolvedValue({ data: { practiceSetId: "x", items: [] } });
    await getPracticeSet("id/with?chars");
    expect(mockGet).toHaveBeenCalledWith("/practice-sets/id%2Fwith%3Fchars");
  });
});

describe("generatePracticeSet class membership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("posts membershipPublicId and omits teacherId", async () => {
    mockPost.mockResolvedValue({
      data: { practiceSetId: "s1", items: [] },
    });
    await generatePracticeSet({
      membershipPublicId: "mem-1",
      specKey: "aqa-gcse-biology",
      topicKeys: ["aqa-gcse-biology:cell-structure"],
      limit: 10,
    });
    expect(mockPost).toHaveBeenCalledWith(
      "/practice-sets/generate",
      expect.objectContaining({
        membershipPublicId: "mem-1",
        specKey: "aqa-gcse-biology",
        topicKeys: ["aqa-gcse-biology:cell-structure"],
      })
    );
    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("teacherId");
  });

  test("legacy teacherId path still sends teacherId when no membership", async () => {
    mockPost.mockResolvedValue({ data: { practiceSetId: "s2", items: [] } });
    await generatePracticeSet({
      teacherId: "tid",
      specKey: "aqa-gcse-biology",
      topicKeys: ["aqa-gcse-biology:cell-structure"],
    });
    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.teacherId).toBe("tid");
    expect(body).not.toHaveProperty("membershipPublicId");
  });
});
