// backend/routes/ops.js — Phase 11.6 Control plane (admin-only)
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const OpsIncident = require("../models/OpsIncident");
const OpsActionAudit = require("../models/OpsActionAudit");
const OpsNotificationLog = require("../models/OpsNotificationLog");
const opsTick = require("../ops/opsTick");
const opsActionExecutor = require("../services/opsActionExecutor");
const opsNotifier = require("../services/opsNotifier");
const { AUTOMATION_LEVELS } = require("../contracts/opsAutopilot.v1");
const { EVENT_TYPES } = require("../contracts/opsNotifications.v1");

const checkAdmin = (req, res, next) => {
  const userType = (req.user?.userType || req.user?.type || "").toString().toLowerCase();
  if (!req.user || userType !== "admin") {
    return res.status(403).json({ msg: "Admin access required" });
  }
  next();
};

/** GET /api/ops/status — automation level, dry-run, last decision, last action, open incidents */
router.get("/status", auth, checkAdmin, async (req, res) => {
  try {
    const openIncidents = await OpsIncident.find({ status: "OPEN" }).sort({ createdAt: -1 }).limit(20).lean();
    const lastAudit = await OpsActionAudit.findOne().sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      env: process.env.NODE_ENV || "development",
      automationLevel: opsTick.getAutomationLevel(),
      dryRun: opsTick.isDryRun ? opsTick.isDryRun() : false,
      manualKillSwitch: opsTick.isManualKillSwitchOn(),
      lastDecision: opsTick.getLastDecision() || null,
      lastActionAt: opsTick.getLastActionAt() ? opsTick.getLastActionAt().toISOString() : null,
      openIncidents: openIncidents.length,
      openIncidentIds: openIncidents.map((i) => i._id),
      lastAuditId: lastAudit?._id || null,
    });
  } catch (err) {
    console.error("GET /api/ops/status error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/** POST /api/ops/level — set L0 / L1 / L2 */
router.post("/level", auth, checkAdmin, (req, res) => {
  const level = (req.body?.level || "").toString().toUpperCase();
  if (!Object.values(AUTOMATION_LEVELS).includes(level)) {
    return res.status(400).json({ msg: "Invalid level", allowed: Object.values(AUTOMATION_LEVELS) });
  }
  opsTick.setAutomationLevel(level);
  res.json({ success: true, automationLevel: opsTick.getAutomationLevel() });
});

/** POST /api/ops/override — manual action execution (audited) */
router.post("/override", auth, checkAdmin, async (req, res) => {
  const { actionType, payload } = req.body || {};
  if (!actionType) {
    return res.status(400).json({ msg: "actionType required" });
  }
  try {
    const result = await opsActionExecutor.execute(actionType, payload || {}, {
      decisionId: "manual_override",
      incidentId: null,
    });
    res.json({ success: true, result });
  } catch (err) {
    console.error("POST /api/ops/override error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/** POST /api/ops/kill-switch — dominant manual override (stops autopilot from acting) */
router.post("/kill-switch", auth, checkAdmin, (req, res) => {
  const enabled = req.body?.enabled === true;
  opsTick.setManualKillSwitch(enabled);
  if (enabled) {
    opsNotifier.notifySafe({ type: EVENT_TYPES.KILL_SWITCH_ENABLED }).catch(() => {});
  }
  res.json({ success: true, manualKillSwitch: opsTick.isManualKillSwitchOn() });
});

/** GET /api/ops/incidents — list open (and optional recent) incidents for admin UI */
router.get("/incidents", auth, checkAdmin, async (req, res) => {
  try {
    const status = req.query.status || "OPEN";
    const limit = Math.min(parseInt(req.query.limit || "50", 10) || 50, 100);
    const list = await OpsIncident.find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, incidents: list });
  } catch (err) {
    console.error("GET /api/ops/incidents error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/** GET /api/ops/audits — list recent audits for admin UI */
router.get("/audits", auth, checkAdmin, async (req, res) => {
  try {
    const resultFilter = req.query.result; // SUCCESS | FAILED | DRY_RUN
    const limit = Math.min(parseInt(req.query.limit || "50", 10) || 50, 100);
    const query = resultFilter ? { result: resultFilter } : {};
    const list = await OpsActionAudit.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, audits: list });
  } catch (err) {
    console.error("GET /api/ops/audits error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/** GET /api/ops/notifications — list recent notification log for admin UI (read-only) */
router.get("/notifications", auth, checkAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10) || 50, 200);
    const resultFilter = req.query.result; // SENT | SKIPPED | FAILED
    const query = resultFilter && ["SENT", "SKIPPED", "FAILED"].includes(resultFilter) ? { result: resultFilter } : {};
    const list = await OpsNotificationLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, notifications: list });
  } catch (err) {
    console.error("GET /api/ops/notifications error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;
