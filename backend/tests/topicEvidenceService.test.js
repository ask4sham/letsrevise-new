/**
 * Unit tests for Topic Evidence service.
 * Tests evidence health classification and summary/recommendations.
 */
const topicEvidenceService = require("../services/topicEvidenceService");

describe("topicEvidenceService", () => {
  describe("classifyEvidenceHealth", () => {
    it("high issue count (>=3) -> weak", () => {
      expect(topicEvidenceService.classifyEvidenceHealth(3, 90, 5, 0)).toBe("weak");
      expect(topicEvidenceService.classifyEvidenceHealth(5, 80, 10, 0)).toBe("weak");
    });

    it("low approval rate (<60) with enough reviewed items -> weak", () => {
      expect(topicEvidenceService.classifyEvidenceHealth(0, 50, 5, 0)).toBe("weak");
      expect(topicEvidenceService.classifyEvidenceHealth(0, 59, 3, 0)).toBe("weak");
    });

    it("moderate issues/revisions -> mixed", () => {
      expect(topicEvidenceService.classifyEvidenceHealth(1, null, 0, 0)).toBe("mixed");
      expect(topicEvidenceService.classifyEvidenceHealth(2, 70, 5, 0)).toBe("mixed");
      expect(topicEvidenceService.classifyEvidenceHealth(0, 65, 5, 1)).toBe("mixed");
    });

    it("good approval + no issues -> strong", () => {
      expect(topicEvidenceService.classifyEvidenceHealth(0, 80, 5, 0)).toBe("strong");
      expect(topicEvidenceService.classifyEvidenceHealth(0, 100, 10, 0)).toBe("strong");
    });

    it("little/no evidence -> unknown", () => {
      expect(topicEvidenceService.classifyEvidenceHealth(0, null, 0, 0)).toBe("unknown");
      expect(topicEvidenceService.classifyEvidenceHealth(0, null, 2, 0)).toBe("unknown");
    });
  });

  describe("classifyIssueRateLevel", () => {
    it("high when >= 3", () => {
      expect(topicEvidenceService.classifyIssueRateLevel(3)).toBe("high");
      expect(topicEvidenceService.classifyIssueRateLevel(5)).toBe("high");
    });
    it("medium when 1-2", () => {
      expect(topicEvidenceService.classifyIssueRateLevel(1)).toBe("medium");
      expect(topicEvidenceService.classifyIssueRateLevel(2)).toBe("medium");
    });
    it("low when 0", () => {
      expect(topicEvidenceService.classifyIssueRateLevel(0)).toBe("low");
    });
  });

  describe("buildTopicEvidenceSummary", () => {
    it("summary and recommendations are deterministic for weak health", () => {
      const raw = {
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        topicTitle: "Cell structure",
        evidenceCounts: { lessonIssues: 3, teacherRevisions: 0, autopilotRuns: 2, autopilotApprovals: 1, autopilotRejections: 2 },
        evidenceSignals: { hasOpenIssues: true, hasHighIssueVolume: true, hasTeacherRevisionActivity: false, hasAutopilotHistory: true, hasLowApprovalRate: true },
        derivedMetrics: { approvalRate: 33, issueRateLevel: "high", evidenceHealth: "weak" },
      };
      const result = topicEvidenceService.buildTopicEvidenceSummary(raw);
      expect(result.derivedMetrics.evidenceHealth).toBe("weak");
      expect(result.summary).toContain("Evidence indicates problems");
      expect(result.summary).toContain("3 open issue");
      expect(result.recommendations).toContain("Review lesson content due to repeated open issues.");
      expect(result.recommendations).toContain("Autopilot output quality is low for this topic; inspect rejection reasons.");
      expect(result.blockers.length).toBeGreaterThan(0);
    });

    it("summary and recommendations are deterministic for strong health", () => {
      const raw = {
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        topicTitle: "Cell structure",
        evidenceCounts: { lessonIssues: 0, teacherRevisions: 0, autopilotRuns: 3, autopilotApprovals: 8, autopilotRejections: 2 },
        evidenceSignals: { hasOpenIssues: false, hasHighIssueVolume: false, hasTeacherRevisionActivity: false, hasAutopilotHistory: true, hasLowApprovalRate: false },
        derivedMetrics: { approvalRate: 80, issueRateLevel: "low", evidenceHealth: "strong" },
      };
      const result = topicEvidenceService.buildTopicEvidenceSummary(raw);
      expect(result.derivedMetrics.evidenceHealth).toBe("strong");
      expect(result.summary).toContain("Evidence is strong");
      expect(result.recommendations).toContain("Evidence is healthy; topic appears stable.");
      expect(result.blockers).toHaveLength(0);
    });

    it("summary and recommendations are deterministic for unknown health", () => {
      const raw = {
        specKey: "aqa-gcse-biology",
        topicKey: "new-topic",
        topicTitle: "New topic",
        evidenceCounts: { lessonIssues: 0, teacherRevisions: 0, autopilotRuns: 0, autopilotApprovals: 0, autopilotRejections: 0 },
        evidenceSignals: { hasOpenIssues: false, hasHighIssueVolume: false, hasTeacherRevisionActivity: false, hasAutopilotHistory: false, hasLowApprovalRate: false },
        derivedMetrics: { approvalRate: null, issueRateLevel: "low", evidenceHealth: "unknown" },
      };
      const result = topicEvidenceService.buildTopicEvidenceSummary(raw);
      expect(result.derivedMetrics.evidenceHealth).toBe("unknown");
      expect(result.summary).toContain("Not enough evidence");
      expect(result.recommendations).toContain("Topic has little evidence yet; monitor after more usage.");
    });

    it("handles null/undefined counts safely", () => {
      const raw = {
        specKey: "test",
        topicKey: "t",
        topicTitle: "T",
        evidenceCounts: {},
        evidenceSignals: {},
        derivedMetrics: { evidenceHealth: "unknown" },
      };
      const result = topicEvidenceService.buildTopicEvidenceSummary(raw);
      expect(result.summary).toBeDefined();
      expect(result.blockers).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });
});
