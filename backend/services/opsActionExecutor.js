// backend/services/opsActionExecutor.js — Phase 11.3 Action plane
const path = require("path");
const fs = require("fs");
const {
  isPermittedAction,
  getCooldownSeconds,
  MAX_ACTIONS_PER_HOUR,
} = require("../contracts/opsAutopilot.v1");
const OpsIncident = require("../models/OpsIncident");
const OpsActionAudit = require("../models/OpsActionAudit");
const opsSignals = require("./opsSignals");

function getConfigPath() {
  const repoRoot = path.resolve(__dirname, "../..");
  return path.join(repoRoot, "config", "revision-engine.json");
}

function readRevisionEngineConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf8");
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

/**
 * Write config atomically: write to temp file then rename. Throws on failure.
 */
function writeRevisionEngineConfig(obj) {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tempPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(obj, null, 2), "utf8");
    fs.renameSync(tempPath, configPath);
  } catch (e) {
    try { fs.unlinkSync(tempPath); } catch {}
    throw e;
  }
}

/** Count actions in last hour (for rate limit). */
async function countActionsInLastHour() {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  return OpsActionAudit.countDocuments({ createdAt: { $gte: since } });
}

/** Last action time for given actionType (for cooldown). */
async function getLastActionAt(actionType) {
  const doc = await OpsActionAudit.findOne({ actionType })
    .sort({ createdAt: -1 })
    .lean();
  return doc?.createdAt ? new Date(doc.createdAt) : null;
}

/**
 * Execute a single allowlisted action. Deny unknown; rate limit; cooldown; always audit.
 * Returns { success, result, auditId, error? }.
 */
async function execute(actionType, payload, context = {}) {
  const beforeSnapshot = opsSignals.getMetricsSnapshot();

  if (!isPermittedAction(actionType)) {
    const audit = await OpsActionAudit.create({
      actionType,
      payload,
      decisionId: context.decisionId,
      incidentId: context.incidentId,
      result: "FAILED",
      beforeSnapshot,
      errorMessage: "Action not in allowlist",
    });
    return { success: false, result: "denied", auditId: audit._id, error: "Action not in allowlist" };
  }

  const count = await countActionsInLastHour();
  if (count >= MAX_ACTIONS_PER_HOUR) {
    const audit = await OpsActionAudit.create({
      actionType,
      payload,
      decisionId: context.decisionId,
      incidentId: context.incidentId,
      result: "FAILED",
      beforeSnapshot,
      errorMessage: "Rate limit: max actions per hour exceeded",
    });
    return { success: false, result: "rate_limited", auditId: audit._id, error: "Max actions per hour exceeded" };
  }

  const lastAt = await getLastActionAt(actionType);
  const cooldownSec = getCooldownSeconds(actionType);
  if (lastAt && (Date.now() - lastAt.getTime()) / 1000 < cooldownSec) {
    const audit = await OpsActionAudit.create({
      actionType,
      payload,
      decisionId: context.decisionId,
      incidentId: context.incidentId,
      result: "FAILED",
      beforeSnapshot,
      errorMessage: `Cooldown: ${cooldownSec}s not elapsed`,
    });
    return { success: false, result: "cooldown", auditId: audit._id, error: "Cooldown not elapsed" };
  }

  let result = "SUCCESS";
  let errorMessage;
  let afterSnapshot;
  let incidentId = context.incidentId;

  try {
    switch (actionType) {
      case "SET_ROLLOUT_PERCENT": {
        const kind = payload?.kind ?? "revision";
        const percent = Math.max(0, Math.min(100, Number(payload?.percent) ?? 0));
        const config = readRevisionEngineConfig();
        config.rolloutPercent = percent;
        writeRevisionEngineConfig(config);
        afterSnapshot = opsSignals.getMetricsSnapshot();
        break;
      }
      case "ENABLE_ALLOWLIST": {
        const kind = payload?.kind ?? "revision";
        const enabled = payload?.enabled === true;
        const config = readRevisionEngineConfig();
        config.allowlistEnabled = enabled;
        writeRevisionEngineConfig(config);
        afterSnapshot = opsSignals.getMetricsSnapshot();
        break;
      }
      case "SET_KILL_SWITCH": {
        const kind = payload?.kind ?? "revision";
        const enabled = payload?.enabled === true;
        const config = readRevisionEngineConfig();
        config.killSwitch = enabled;
        writeRevisionEngineConfig(config);
        afterSnapshot = opsSignals.getMetricsSnapshot();
        break;
      }
      case "SET_REVISION_NO_FALLBACK": {
        if (process.env.NODE_ENV === "production") {
          result = "FAILED";
          errorMessage = "SET_REVISION_NO_FALLBACK only allowed in non-production";
        } else {
          const enabled = payload?.enabled === true;
          process.env.REVISION_NO_FALLBACK = enabled ? "1" : "0";
          afterSnapshot = opsSignals.getMetricsSnapshot();
        }
        break;
      }
      case "OPEN_INCIDENT": {
        const doc = await OpsIncident.create({
          type: payload?.type ?? "OPS",
          severity: payload?.severity ?? "medium",
          status: "OPEN",
          decisionSnapshot: payload?.decisionSnapshot,
          title: payload?.title,
          details: payload?.details,
        });
        incidentId = doc._id;
        afterSnapshot = opsSignals.getMetricsSnapshot();
        break;
      }
      case "NOTIFY_ADMIN": {
        afterSnapshot = { loggedAt: new Date().toISOString(), payload: payload?.payload ?? payload };
        break;
      }
      default:
        result = "FAILED";
        errorMessage = "Unknown action handler";
    }
  } catch (e) {
    result = "FAILED";
    errorMessage = e && e.message ? e.message : String(e);
    afterSnapshot = opsSignals.getMetricsSnapshot();
  }

  const audit = await OpsActionAudit.create({
    actionType,
    payload,
    decisionId: context.decisionId,
    incidentId,
    result,
    beforeSnapshot,
    afterSnapshot,
    errorMessage: result === "FAILED" ? errorMessage : undefined,
  });

  return {
    success: result === "SUCCESS",
    result,
    auditId: audit._id,
    incidentId: incidentId || undefined,
    error: result === "FAILED" ? errorMessage : undefined,
  };
}

module.exports = {
  execute,
  getConfigPath,
  readRevisionEngineConfig,
  writeRevisionEngineConfig,
  countActionsInLastHour,
  getLastActionAt,
};
