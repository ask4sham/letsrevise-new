/**
 * practiceSets API — getPracticeSet by ID (resume).
 */
import api from "../services/api";
import { getPracticeSet } from "./practiceSets";

jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockGet = api.get as jest.Mock;

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
