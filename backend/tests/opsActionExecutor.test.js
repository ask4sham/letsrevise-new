// backend/tests/opsActionExecutor.test.js — Phase 11.9
const mongoose = require("mongoose");
const opsActionExecutor = require("../services/opsActionExecutor");
const OpsActionAudit = require("../models/OpsActionAudit");

describe("opsActionExecutor", () => {
  test("rejects unknown action and writes audit with FAILED", async () => {
    const beforeCount = await OpsActionAudit.countDocuments();
    const result = await opsActionExecutor.execute("UNKNOWN_ACTION_TYPE", {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/allowlist|not in allowlist/i);
    const afterCount = await OpsActionAudit.countDocuments();
    expect(afterCount).toBe(beforeCount + 1);
    const audit = await OpsActionAudit.findOne({ actionType: "UNKNOWN_ACTION_TYPE" }).sort({ createdAt: -1 }).lean();
    expect(audit).toBeDefined();
    expect(audit.result).toBe("FAILED");
    expect(audit.errorMessage).toBeDefined();
  });

  test("audit is always written on execute (allowed action OPEN_INCIDENT)", async () => {
    const beforeCount = await OpsActionAudit.countDocuments();
    const result = await opsActionExecutor.execute("OPEN_INCIDENT", {
      type: "TEST",
      severity: "low",
      title: "Test incident",
    });
    expect(result.success).toBe(true);
    const afterCount = await OpsActionAudit.countDocuments();
    expect(afterCount).toBe(beforeCount + 1);
    const audit = await OpsActionAudit.findOne({ actionType: "OPEN_INCIDENT" }).sort({ createdAt: -1 }).lean();
    expect(audit).toBeDefined();
    expect(audit.result).toBe("SUCCESS");
  });
});
