/**
 * PR-009: Coverage API controller — live compute + snapshots + filtered topics.
 */
const { computeCoverage } = require("../services/coverage/coverageEngine");
const CoverageSnapshot = require("../models/CoverageSnapshot");
const { normalizeSpecKey } = require("../config/featureFlags");
const { sendInternalError } = require("../utils/safeErrorResponse");

/**
 * GET /api/coverage — live computed coverage (no DB write).
 */
async function getCoverage(req, res) {
  try {
    const specKey = (req.query.specKey || "").trim();
    if (!specKey) {
      return res.status(400).json({ error: "specKey is required" });
    }
    const windowDays = Math.min(90, Math.max(1, parseInt(req.query.windowDays, 10) || 14));
    const rows = await computeCoverage({ specKey, windowDays });
    return res.json({ specKey: normalizeSpecKey(specKey), windowDays, rows });
  } catch (err) {
    console.error("[coverage] getCoverage error:", err);
    return sendInternalError("coverage/get", err, res);
  }
}

/**
 * GET /api/coverage/snapshots — latest saved snapshot rows.
 */
async function getSnapshots(req, res) {
  try {
    const specKey = (req.query.specKey || "").trim();
    if (!specKey) {
      return res.status(400).json({ error: "specKey is required" });
    }
    const latest = req.query.latest !== "false" && req.query.latest !== "0";
    const normalized = normalizeSpecKey(specKey);

    if (latest) {
      const latestDoc = await CoverageSnapshot.findOne({ specKey: normalized })
        .sort({ computedAt: -1 })
        .lean();
      if (!latestDoc) {
        return res.json({
          specKey: normalized,
          rows: [],
          hint: "No snapshots found. Run: node backend/scripts/buildCoverageReport.js --specKey " + normalized + " --apply",
        });
      }
      const rows = await CoverageSnapshot.find({
        specKey: normalized,
        computedAt: latestDoc.computedAt,
      })
        .sort({ topicKey: 1 })
        .lean();
      return res.json({
        specKey: normalized,
        computedAt: latestDoc.computedAt,
        windowDays: latestDoc.windowDays,
        rows,
      });
    }

    const rows = await CoverageSnapshot.find({ specKey: normalized })
      .sort({ computedAt: -1, topicKey: 1 })
      .limit(500)
      .lean();
    return res.json({ specKey: normalized, rows });
  } catch (err) {
    console.error("[coverage] getSnapshots error:", err);
    return sendInternalError("coverage/snapshots", err, res);
  }
}

/**
 * GET /api/coverage/topics — filtered topicKeys by status.
 */
async function getTopics(req, res) {
  try {
    const specKey = (req.query.specKey || "").trim();
    const status = (req.query.status || "").trim().toUpperCase();
    if (!specKey) {
      return res.status(400).json({ error: "specKey is required" });
    }
    const normalized = normalizeSpecKey(specKey);
    const validStatuses = ["NO_SPEC", "EMPTY", "THIN", "OK", "STRONG"];
    const statusFilter = status && validStatuses.includes(status) ? status : null;

    const latestDoc = await CoverageSnapshot.findOne({ specKey: normalized })
      .sort({ computedAt: -1 })
      .lean();

    if (!latestDoc) {
      return res.json({
        specKey: normalized,
        topicKeys: [],
        summary: {},
        hint: "No snapshots found. Run: node backend/scripts/buildCoverageReport.js --specKey " + normalized + " --apply",
      });
    }

    let query = { specKey: normalized, computedAt: latestDoc.computedAt };
    if (statusFilter) query.status = statusFilter;

    const rows = await CoverageSnapshot.find(query).sort({ score: 1, topicKey: 1 }).lean();

    const summary = {};
    for (const r of rows) {
      summary[r.status] = (summary[r.status] || 0) + 1;
    }

    return res.json({
      specKey: normalized,
      computedAt: latestDoc.computedAt,
      topicKeys: rows.map((r) => ({
        topicKey: r.topicKey,
        status: r.status,
        score: r.score,
        enquiriesTotal: r.enquiriesTotal,
        enquiriesWeakEvidence: r.enquiriesWeakEvidence,
        weakRate: r.weakRate,
      })),
      summary,
    });
  } catch (err) {
    console.error("[coverage] getTopics error:", err);
    return sendInternalError("coverage/topics", err, res);
  }
}

module.exports = { getCoverage, getSnapshots, getTopics };
