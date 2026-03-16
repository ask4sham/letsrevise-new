/**
 * Unit tests for Evidence Review Worklist service.
 */
const evidenceReviewWorklistService = require("../services/evidenceReviewWorklistService");

describe("evidenceReviewWorklistService", () => {
  describe("computePriorityScore", () => {
    it("blocked topic ranks above review_required", () => {
      const block = {
        gateStatus: "block",
        evidenceSummary: { openIssues: 0, teacherRevisions: 0, approvalRate: null, autopilotRejections: 0 },
      };
      const review = {
        gateStatus: "review_required",
        evidenceSummary: { openIssues: 0, teacherRevisions: 0, approvalRate: null, autopilotRejections: 0 },
      };
      const blockScore = evidenceReviewWorklistService.computePriorityScore(block);
      const reviewScore = evidenceReviewWorklistService.computePriorityScore(review);
      expect(blockScore).toBeGreaterThan(reviewScore);
    });

    it("high issues increase priority", () => {
      const low = {
        gateStatus: "review_required",
        evidenceSummary: { openIssues: 1, teacherRevisions: 0, approvalRate: 80, autopilotApprovals: 5, autopilotRejections: 0 },
      };
      const high = {
        gateStatus: "review_required",
        evidenceSummary: { openIssues: 3, teacherRevisions: 0, approvalRate: 80, autopilotApprovals: 5, autopilotRejections: 0 },
      };
      const lowScore = evidenceReviewWorklistService.computePriorityScore(low);
      const highScore = evidenceReviewWorklistService.computePriorityScore(high);
      expect(highScore).toBeGreaterThan(lowScore);
    });

    it("low approval rate adds to priority", () => {
      const item = {
        gateStatus: "review_required",
        evidenceSummary: { openIssues: 0, teacherRevisions: 0, approvalRate: 40, autopilotApprovals: 2, autopilotRejections: 3 },
      };
      const score = evidenceReviewWorklistService.computePriorityScore(item);
      expect(score).toBeGreaterThan(25);
    });
  });

  describe("buildReviewActions", () => {
    it("low approval rate adds inspect_rejections action", () => {
      const item = {
        gateStatus: "review_required",
        reasons: [],
        evidenceSummary: { openIssues: 0, teacherRevisions: 0, approvalRate: 40, autopilotApprovals: 2, autopilotRejections: 3 },
      };
      const actions = evidenceReviewWorklistService.buildReviewActions(item);
      const inspect = actions.find((a) => a.type === "inspect_rejections");
      expect(inspect).toBeDefined();
      expect(inspect.label).toContain("Inspect");
    });

    it("open issues add resolve_open_issues and review_content", () => {
      const item = {
        gateStatus: "block",
        reasons: [],
        evidenceSummary: { openIssues: 2, teacherRevisions: 0, approvalRate: null, autopilotRejections: 0 },
      };
      const actions = evidenceReviewWorklistService.buildReviewActions(item);
      expect(actions.some((a) => a.type === "resolve_open_issues")).toBe(true);
      expect(actions.some((a) => a.type === "review_content")).toBe(true);
    });
  });

  describe("rankEvidenceReviewItems", () => {
    it("higher priority sorts first", () => {
      const items = [
        { topicKey: "a", priorityScore: 30 },
        { topicKey: "b", priorityScore: 50 },
        { topicKey: "c", priorityScore: 40 },
      ];
      const ranked = evidenceReviewWorklistService.rankEvidenceReviewItems(items);
      expect(ranked[0].priorityScore).toBe(50);
      expect(ranked[1].priorityScore).toBe(40);
      expect(ranked[2].priorityScore).toBe(30);
    });

    it("same priority sorts by topicKey", () => {
      const items = [
        { topicKey: "z-topic", priorityScore: 25 },
        { topicKey: "a-topic", priorityScore: 25 },
      ];
      const ranked = evidenceReviewWorklistService.rankEvidenceReviewItems(items);
      expect(ranked[0].topicKey).toBe("a-topic");
    });
  });

  describe("deterministic output", () => {
    it("same inputs produce same priority and actions", () => {
      const item = {
        gateStatus: "review_required",
        reasons: ["Evidence health is weak."],
        evidenceSummary: { openIssues: 2, teacherRevisions: 1, approvalRate: 33, autopilotApprovals: 1, autopilotRejections: 2 },
      };
      const score1 = evidenceReviewWorklistService.computePriorityScore(item);
      const score2 = evidenceReviewWorklistService.computePriorityScore(item);
      expect(score1).toBe(score2);
      const actions1 = evidenceReviewWorklistService.buildReviewActions(item);
      const actions2 = evidenceReviewWorklistService.buildReviewActions(item);
      expect(actions1.map((a) => a.type)).toEqual(actions2.map((a) => a.type));
    });
  });
});
