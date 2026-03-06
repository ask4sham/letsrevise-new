/**
 * PR-012: Sprint order controller — generate markdown for download.
 */
const { buildSprintOrderMarkdown, loadSnapshots, writeSnapshots, specKeyDisplay } = require("../services/sprintOrder/sprintOrderService");
const { normalizeSpecKey } = require("../config/featureFlags");

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

function isAdmin(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "admin" || req.user?.isAdmin === true;
}

function parseWeights(weightsStr) {
  let coverage = 0.65;
  let weak = 0.35;
  if (weightsStr) {
    const m1 = String(weightsStr).match(/coverage=([\d.]+)/);
    const m2 = String(weightsStr).match(/weak=([\d.]+)/);
    if (m1) coverage = parseFloat(m1[1]) || 0.65;
    if (m2) weak = parseFloat(m2[1]) || 0.35;
  }
  return { coverage, weak };
}

/**
 * GET /api/sprint-order — generate markdown for download (teacher/admin).
 * Never writes snapshots. Rate limited.
 */
async function getSprintOrderMarkdown(req, res) {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }

  const specKey = req.query.specKey?.trim();
  if (!specKey) {
    return res.status(400).json({ error: "specKey is required" });
  }

  const windowDays = Math.min(90, Math.max(1, parseInt(req.query.windowDays, 10) || 14));
  const useSnapshots = req.query.useSnapshots !== "false";
  const top = Math.min(500, Math.max(1, parseInt(req.query.top, 10) || 200));
  const minEnquiries = Math.max(0, parseInt(req.query.minEnquiries, 10) || 3);
  const weights = parseWeights(req.query.weights);

  try {
    const { markdown, meta } = await buildSprintOrderMarkdown({
      specKey,
      windowDays,
      useSnapshots,
      top,
      minEnquiries,
      weights,
      applyIfMissingSnapshots: false,
    });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
    const filename = `SPRINT_ORDER_${meta.specKeyDisplay}_${dateStr}_${timeStr}.md`;

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-SprintOrder-Source", meta.source);
    res.send(markdown);
  } catch (err) {
    console.error("[sprintOrder] Error:", err);
    res.status(500).json({ error: err.message || "Failed to generate sprint order" });
  }
}

/**
 * POST /api/sprint-order/snapshots/ensure — admin only.
 * Compute + write snapshots if missing. Requires X-Confirm: "APPLY <SPEC_DISPLAY>".
 */
async function ensureSnapshots(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Admins only" });
  }

  const specKey = req.body?.specKey?.trim() || req.body?.specKey;
  if (!specKey) {
    return res.status(400).json({ error: "specKey is required in body" });
  }

  const normalized = normalizeSpecKey(specKey);
  const displayKey = specKeyDisplay(normalized);
  const requiredConfirm = `APPLY ${displayKey}`;
  const receivedConfirm = (req.headers["x-confirm"] || "").trim();

  if (receivedConfirm !== requiredConfirm) {
    return res.status(400).json({
      error: "Missing or invalid confirmation",
      hint: `Set header X-Confirm to exactly: ${requiredConfirm}`,
    });
  }

  const windowDays = Math.min(90, Math.max(1, parseInt(req.body?.windowDays, 10) || 14));

  try {
    const snapshot = await loadSnapshots(normalized);
    if (snapshot) {
      return res.json({ ok: true, wrote: false, computedAt: snapshot.computedAt });
    }

    const { computedAt } = await writeSnapshots(normalized, windowDays);
    res.json({ ok: true, wrote: true, computedAt });
  } catch (err) {
    console.error("[sprintOrder] ensureSnapshots error:", err);
    res.status(500).json({ error: err.message || "Failed to ensure snapshots" });
  }
}

module.exports = {
  getSprintOrderMarkdown,
  ensureSnapshots,
};
