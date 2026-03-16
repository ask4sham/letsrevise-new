/**
 * Tests for Autopilot Prompt Experiment — assignment and results.
 */
const mockFind = jest.fn();
const mockFindByIdAndUpdate = jest.fn();
const mockFindOne = jest.fn();

jest.mock("../models/AutopilotPromptExperiment", () => ({
  find: () => mockFind(),
  findByIdAndUpdate: (...args) => mockFindByIdAndUpdate(...args),
  findOne: (...args) => mockFindOne(...args),
}));

jest.mock("../models/AutopilotRun", () => ({ find: jest.fn().mockReturnValue({ select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) }) }));
jest.mock("../models/TopicFlashcard", () => ({ countDocuments: jest.fn().mockResolvedValue(0) }));
jest.mock("../models/TopicQuizQuestion", () => ({ countDocuments: jest.fn().mockResolvedValue(0) }));
jest.mock("../models/ExamQuestion", () => ({ countDocuments: jest.fn().mockResolvedValue(0) }));

const { resolvePromptPackForRun } = require("../services/autopilotPromptMetadata");
const autopilotOutcomesService = require("../services/autopilotOutcomesService");

describe("autopilotPromptExperiment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("experiment assignment", () => {
    it("uses requested pack when admin explicitly selects", async () => {
      const r = await resolvePromptPackForRun({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        requestedPack: { promptPackId: "autopilot-core", promptPackVersion: "v2" },
      });
      expect(r.error).toBeUndefined();
      expect(r.pack.promptPackId).toBe("autopilot-core");
      expect(r.pack.promptPackVersion).toBe("v2");
      expect(r.experimentId).toBeNull();
    });

    it("uses default pack when no experiment and no requested pack", async () => {
      mockFind.mockReturnValueOnce({
        sort: () => ({ lean: () => Promise.resolve([]) }),
      });
      const r = await resolvePromptPackForRun({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        requestedPack: null,
      });
      expect(r.error).toBeUndefined();
      expect(r.pack.promptPackId).toBe("autopilot-core");
      expect(r.pack.promptPackVersion).toBe("v1");
      expect(r.experimentId).toBeNull();
    });

    it("assigns pack via active experiment (round_robin)", async () => {
      const exp = {
        _id: "exp1",
        experimentId: "test-rr",
        specKey: "aqa-gcse-biology",
        topicKey: null,
        promptPacks: [
          { promptPackId: "autopilot-core", promptPackVersion: "v1", weight: 1 },
          { promptPackId: "autopilot-core", promptPackVersion: "v2", weight: 1 },
        ],
        assignmentMode: "round_robin",
        status: "active",
      };
      mockFind.mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve([exp]),
        }),
      });
      mockFindByIdAndUpdate
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue({ _roundRobinIndex: 0 }) })
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue({ _roundRobinIndex: 1 }) });

      const r1 = await resolvePromptPackForRun({ specKey: "aqa-gcse-biology", topicKey: "topic-1", requestedPack: null });
      const r2 = await resolvePromptPackForRun({ specKey: "aqa-gcse-biology", topicKey: "topic-2", requestedPack: null });

      expect(r1.experimentId).toBe("test-rr");
      expect(r2.experimentId).toBe("test-rr");
      expect(["v1", "v2"]).toContain(r1.pack.promptPackVersion);
      expect(["v1", "v2"]).toContain(r2.pack.promptPackVersion);
    });

    it("assigns pack via weighted_random", async () => {
      const exp = {
        _id: "exp2",
        experimentId: "test-wr",
        specKey: "aqa-gcse-biology",
        topicKey: null,
        promptPacks: [
          { promptPackId: "autopilot-core", promptPackVersion: "v1", weight: 2 },
          { promptPackId: "autopilot-core", promptPackVersion: "v2", weight: 1 },
        ],
        assignmentMode: "weighted_random",
        status: "active",
      };
      mockFind.mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve([exp]),
        }),
      });

      const r = await resolvePromptPackForRun({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        requestedPack: null,
      });
      expect(r.experimentId).toBe("test-wr");
      expect(["v1", "v2"]).toContain(r.pack.promptPackVersion);
    });

    it("does not apply paused experiment", async () => {
      mockFind.mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve([]),
        }),
      });

      const r = await resolvePromptPackForRun({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        requestedPack: null,
      });
      expect(r.experimentId).toBeNull();
      expect(r.pack.promptPackVersion).toBe("v1");
    });
  });

  describe("getExperimentPerformance", () => {
    it("returns null for unknown experiment", async () => {
      mockFindOne.mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(null) });
      const r = await autopilotOutcomesService.getExperimentPerformance("nonexistent");
      expect(r).toBeNull();
    });

    it("returns performance shape for existing experiment", async () => {
      mockFindOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          experimentId: "perf-test",
          label: "Perf Test",
          status: "active",
          promptPacks: [
            { promptPackId: "autopilot-core", promptPackVersion: "v1", weight: 1 },
            { promptPackId: "autopilot-core", promptPackVersion: "v2", weight: 1 },
          ],
        }),
      });
      const r = await autopilotOutcomesService.getExperimentPerformance("perf-test");
      expect(r).not.toBeNull();
      expect(r.experimentId).toBe("perf-test");
      expect(r.label).toBe("Perf Test");
      expect(Array.isArray(r.promptPacks)).toBe(true);
      expect(r.promptPacks.length).toBe(2);
      expect(r.promptPacks[0]).toMatchObject({
        promptPackId: "autopilot-core",
        runs: expect.any(Number),
        generatedItems: expect.any(Number),
        approvedItems: expect.any(Number),
        rejectedItems: expect.any(Number),
      });
    });
  });
});
