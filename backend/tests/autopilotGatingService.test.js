/**
 * Unit tests for Autopilot Gating service.
 * Tests evidence-aware gate decisions.
 */
const autopilotGatingService = require("../services/autopilotGatingService");

describe("autopilotGatingService", () => {
  describe("decideAutopilotGateFromEvidence", () => {
    it("strong evidence + ready => allow", () => {
      const evidence = {
        derivedMetrics: { evidenceHealth: "strong" },
        evidenceCounts: { lessonIssues: 0, autopilotApprovals: 8, autopilotRejections: 2 },
      };
      const readiness = { ready: true };
      const gap = { counts: { openIssues: 0 } };
      const gate = autopilotGatingService.decideAutopilotGateFromEvidence(evidence, readiness, gap);
      expect(gate.gateStatus).toBe("allow");
      expect(gate.allowedActions).toContain("generate_flashcards");
      expect(gate.allowedActions).toContain("generate_quiz");
      expect(gate.allowedActions).toContain("generate_exam_questions");
      expect(gate.blockedActions).toHaveLength(0);
    });

    it("mixed evidence => limited", () => {
      const evidence = {
        derivedMetrics: { evidenceHealth: "mixed" },
        evidenceCounts: { lessonIssues: 1 },
      };
      const readiness = { ready: true };
      const gap = { counts: { openIssues: 1 } };
      const gate = autopilotGatingService.decideAutopilotGateFromEvidence(evidence, readiness, gap);
      expect(gate.gateStatus).toBe("limited");
      expect(gate.allowedActions).toContain("generate_flashcards");
      expect(gate.allowedActions).toContain("generate_quiz");
      expect(gate.blockedActions).toContain("generate_exam_questions");
    });

    it("weak evidence => review_required", () => {
      const evidence = {
        derivedMetrics: { evidenceHealth: "weak" },
        evidenceCounts: { lessonIssues: 1, autopilotApprovals: 1, autopilotRejections: 2 },
      };
      const readiness = { ready: true };
      const gap = { counts: { openIssues: 1 } };
      const gate = autopilotGatingService.decideAutopilotGateFromEvidence(evidence, readiness, gap);
      expect(gate.gateStatus).toBe("review_required");
      expect(gate.allowedActions).toHaveLength(0);
      expect(gate.blockedActions.length).toBeGreaterThan(0);
    });

    it("weak evidence + high issues => block", () => {
      const evidence = {
        derivedMetrics: { evidenceHealth: "weak" },
        evidenceCounts: { lessonIssues: 3 },
      };
      const readiness = { ready: true };
      const gap = { counts: { openIssues: 3 } };
      const gate = autopilotGatingService.decideAutopilotGateFromEvidence(evidence, readiness, gap);
      expect(gate.gateStatus).toBe("block");
      expect(gate.allowedActions).toHaveLength(0);
      expect(gate.reasons.some((r) => r.includes("weak") || r.includes("high"))).toBe(true);
    });

    it("non-ready topic => block", () => {
      const evidence = { derivedMetrics: { evidenceHealth: "strong" } };
      const readiness = { ready: false, blockers: ["Missing specification statements"] };
      const gap = { counts: { openIssues: 0 } };
      const gate = autopilotGatingService.decideAutopilotGateFromEvidence(evidence, readiness, gap);
      expect(gate.gateStatus).toBe("block");
      expect(gate.allowedActions).toHaveLength(0);
      expect(gate.reasons).toContain("Topic is not autopilot-ready.");
    });

    it("low approval rate => review_required", () => {
      const evidence = {
        derivedMetrics: { evidenceHealth: "mixed", approvalRate: 40 },
        evidenceCounts: { lessonIssues: 0, autopilotApprovals: 2, autopilotRejections: 3 },
      };
      const readiness = { ready: true };
      const gap = {};
      const gate = autopilotGatingService.decideAutopilotGateFromEvidence(evidence, readiness, gap);
      expect(gate.gateStatus).toBe("review_required");
      expect(gate.allowedActions).toHaveLength(0);
    });

    it("action filtering: limited blocks exam questions only", () => {
      const evidence = {
        derivedMetrics: { evidenceHealth: "mixed" },
        evidenceCounts: { lessonIssues: 2 },
      };
      const readiness = { ready: true };
      const gap = { counts: { openIssues: 2 } };
      const gate = autopilotGatingService.decideAutopilotGateFromEvidence(evidence, readiness, gap);
      expect(gate.gateStatus).toBe("limited");
      expect(gate.allowedActions).toEqual(["generate_flashcards", "generate_quiz"]);
      expect(gate.blockedActions).toEqual(["generate_exam_questions"]);
    });

    it("unknown evidence + ready => allow", () => {
      const evidence = {
        derivedMetrics: { evidenceHealth: "unknown" },
        evidenceCounts: { lessonIssues: 0, autopilotRuns: 0 },
      };
      const readiness = { ready: true };
      const gap = { counts: { openIssues: 0 } };
      const gate = autopilotGatingService.decideAutopilotGateFromEvidence(evidence, readiness, gap);
      expect(gate.gateStatus).toBe("allow");
      expect(gate.allowedActions.length).toBe(3);
    });
  });
});
