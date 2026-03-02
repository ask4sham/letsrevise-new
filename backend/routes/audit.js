/**
 * Audit API — question bank audit (Content Coverage) and sprint order doc.
 * GET /api/audit/question-bank?specKey=aqa-gcse-biology — same data as SPRINT_ORDER docs.
 * GET /api/audit/sprint-order-doc?specKey=aqa-gcse-biology — returns markdown file.
 * specKey accepts hyphen or underscore; internally normalized so taxonomy lookup and filenames match.
 */
const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const auth = require("../middleware/auth");
const { runQuestionBankAudit } = require("../services/questionBankAuditService");
const { getTaxonomyBySpecKey } = require("../utils/topicTaxonomy");
const normalizeSpecKey = require("../utils/normalizeSpecKey");
const { specKeyForFilename } = require("../utils/normalizeSpecKey");

const CACHE_TTL_MS = 5 * 60 * 1000;
const questionBankCache = new Map();

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

/** Docs viewer expects hyphen filenames (e.g. SPRINT_ORDER_aqa-gcse-biology.md). Resolve from backend to repo root. */
function getDocsOutDir() {
  const repoRoot = path.resolve(__dirname, "..", "..");
  return path.join(repoRoot, "frontend", "public", "docs");
}

/** GET /api/audit/question-bank?specKey=aqa-gcse-biology — read-only aggregations; no OpenAI, no external calls */
router.get("/question-bank", auth, async (req, res) => {
  const raw = req.query.specKey != null ? String(req.query.specKey).trim() : "";
  if (!raw) {
    return res.status(400).json({ error: "specKey query param is required" });
  }
  const start = Date.now();
  const specKeyNormalized = normalizeSpecKey(raw);
  const specKey = specKeyForFilename(specKeyNormalized) || raw;
  console.log("[audit/question-bank] start", { raw, specKey });
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const taxonomy = getTaxonomyBySpecKey(specKey);
    if (!taxonomy || !Array.isArray(taxonomy.units)) {
      return res.status(400).json({ error: `Invalid specKey: ${specKey}` });
    }

    const cached = questionBankCache.get(specKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      const duration = Date.now() - start;
      console.log("[audit/question-bank] cache hit", { specKey, durationMs: duration });
      return res.json(cached.data);
    }

    const result = await runQuestionBankAudit({ specKey });
    questionBankCache.set(specKey, { at: Date.now(), data: result });
    const duration = Date.now() - start;
    console.log("[audit/question-bank] end", { specKey, durationMs: duration, rows: result.rows.length });
    return res.json({ ok: true, specKey, ...result });
  } catch (err) {
    console.error("[audit/question-bank] error", err);
    console.error("[audit/question-bank] stack", err?.stack);
    return res.status(500).json({
      error: "Failed to build question bank audit",
      message: err?.message || "Unknown error",
    });
  }
});

/** GET /api/audit/sprint-order-doc?specKey=aqa-gcse-biology — serve from frontend/public/docs with hyphen filename */
router.get("/sprint-order-doc", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  const raw = String(req.query.specKey || "").trim();
  if (!raw) {
    return res.status(400).json({ error: "specKey is required" });
  }
  const fileKey = specKeyForFilename(normalizeSpecKey(raw)) || raw;
  const docsDir = getDocsOutDir();
  const filePath = path.join(docsDir, `SPRINT_ORDER_${fileKey}.md`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: `Sprint order doc not found for ${raw}. Run the audit script to generate frontend/public/docs/SPRINT_ORDER_${fileKey}.md`,
    });
  }
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `inline; filename="SPRINT_ORDER_${fileKey}.md"`);
  res.sendFile(filePath);
});

/** GET /api/audit/content-coverage?specKey=... — same JSON as question-bank (normalized specKey). */
router.get("/content-coverage", auth, async (req, res) => {
  const raw = String(req.query.specKey || "").trim();
  const specKey = specKeyForFilename(normalizeSpecKey(raw)) || raw;
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  if (!specKey) return res.status(400).json({ error: "specKey is required" });
  try {
    const taxonomy = getTaxonomyBySpecKey(specKey);
    if (!taxonomy || !Array.isArray(taxonomy.units)) {
      return res.status(400).json({ error: `Invalid specKey: ${specKey}` });
    }
    const result = await runQuestionBankAudit({ specKey });
    return res.json({ specKey, ...result });
  } catch (err) {
    console.error("[audit/content-coverage]", { raw, specKey, err });
    return res.status(500).json({ error: "Failed to build content coverage", specKey, message: err?.message });
  }
});

module.exports = router;
