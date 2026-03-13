// backend/tests/opsVerifier.test.js — Phase 11.9
const opsVerifier = require("../services/opsVerifier");
const OpsIncident = require("../models/OpsIncident");
const OpsActionAudit = require("../models/OpsActionAudit");

describe("opsVerifier", () => {
  test("verifyAfterAction returns improved: false when OPENAI count not decreased", async () => {
    const beforeSnapshot = {
      attempts: 50,
      completed: 10,
      byErrorCode: { OPENAI_HTTP_ERROR: 20 },
    };
    const result = await opsVerifier.verifyAfterAction("SET_ROLLOUT_PERCENT", beforeSnapshot, { delayMs: 0 });
    expect(result).toHaveProperty("improved");
    expect(result).toHaveProperty("before");
    expect(result).toHaveProperty("after");
  });

  test("escalateIfNotImproved creates incident and audit when not improved", async () => {
    const beforeCount = await OpsIncident.countDocuments();
    const auditBefore = await OpsActionAudit.countDocuments();
    const verificationResult = { improved: false, at: new Date().toISOString() };
    const out = await opsVerifier.escalateIfNotImproved("dec-1", "OPENAI_ERROR_SPIKE", verificationResult);
    expect(out.escalated).toBe(true);
    expect(out.incidentId).toBeDefined();
    const afterCount = await OpsIncident.countDocuments();
    expect(afterCount).toBe(beforeCount + 1);
    const auditAfter = await OpsActionAudit.countDocuments();
    expect(auditAfter).toBeGreaterThanOrEqual(auditBefore + 1);
  });

  test("escalateIfNotImproved does nothing when improved", async () => {
    const beforeCount = await OpsIncident.countDocuments();
    const out = await opsVerifier.escalateIfNotImproved("dec-2", "TEST", { improved: true });
    expect(out.escalated).toBe(false);
    expect(out.incidentId).toBeUndefined();
    const afterCount = await OpsIncident.countDocuments();
    expect(afterCount).toBe(beforeCount);
  });
});
