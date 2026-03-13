// backend/tests/opsDecisionEngine.test.js — Phase 11.9
const opsDecisionEngine = require("../services/opsDecisionEngine");
const opsSignals = require("../services/opsSignals");

describe("opsDecisionEngine", () => {
  describe("run with synthetic snapshots", () => {
    test("returns null when no rules fire", () => {
      const snapshot = {
        at: new Date().toISOString(),
        metrics: { attempts: 0, completed: 0, stub: 0, recent: [], lastCompletedAt: null },
        alerts: { ok: true, alerts: [] },
      };
      const decision = opsDecisionEngine.run(snapshot);
      expect(decision).toBeNull();
    });

    test("returns OPENAI_ERROR_SPIKE when OPENAI_* count in recent >= 15", () => {
      const recent = [];
      for (let i = 0; i < 20; i++) {
        recent.push({ status: "STUB", errorCode: "OPENAI_HTTP_ERROR", at: new Date().toISOString() });
      }
      const snapshot = {
        at: new Date().toISOString(),
        metrics: { attempts: 100, completed: 50, stub: 50, recent, lastCompletedAt: new Date().toISOString() },
        alerts: { ok: false, alerts: [{ id: "SPIKE_OPENAI_FAILURES" }] },
      };
      const decision = opsDecisionEngine.run(snapshot);
      expect(decision).not.toBeNull();
      expect(decision.incidentType).toBe("OPENAI_ERROR_SPIKE");
      expect(decision.recommendedPlaybookId).toBe("OPENAI_ERROR_SPIKE");
    });

    test("returns ENGINE_SPAWN_FAILED when spawn failed count >= 5", () => {
      const recent = [];
      for (let i = 0; i < 6; i++) {
        recent.push({ status: "STUB", errorCode: "ENGINE_SPAWN_FAILED", at: new Date().toISOString() });
      }
      const snapshot = {
        at: new Date().toISOString(),
        metrics: { attempts: 10, completed: 0, stub: 10, recent, lastCompletedAt: null },
        alerts: { ok: false, alerts: [{ id: "SPIKE_ENGINE_SPAWN_FAILED" }] },
      };
      const decision = opsDecisionEngine.run(snapshot);
      expect(decision).not.toBeNull();
      expect(decision.incidentType).toBe("ENGINE_SPAWN_FAILED");
    });
  });
});
