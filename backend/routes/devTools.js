/**
 * PR-W2.3: Dev-only endpoints for 1-click question bank seeding.
 * Enabled only when ENABLE_DEV_TOOLS=1. Teacher or admin required.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const path = require("path");
const auth = require("../middleware/auth");

const DEV_TOOLS_ENABLED = process.env.ENABLE_DEV_TOOLS === "1";

function isTeacherOrAdmin(req) {
  const type = (req.user?.userType || req.user?.type || "").toString().toLowerCase();
  return type === "teacher" || type === "admin";
}

/**
 * POST /api/dev/seed/aqa-gcse-biology/:scope
 * scope: cell-biology | cell-biology-batch-a | cell-biology-batch-b | cell-biology-batch-c |
 *        organisation | infection-and-response | bioenergetics | homeostasis-and-response |
 *        inheritance-variation-evolution | ecology | all
 */
router.post("/seed/aqa-gcse-biology/:scope", auth, async (req, res) => {
  if (!DEV_TOOLS_ENABLED) {
    return res.status(404).json({ ok: false, msg: "Not found" });
  }
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ ok: false, msg: "Teachers and admins only" });
  }

  const scope = (req.params.scope || "").trim().toLowerCase();
  const scopeToRunner = {
    "cell-biology": "seed_unit_cell_biology",
    "cell-biology-batch-a": "seed_batch_cell_biology_A",
    "cell-biology-batch-b": "seed_batch_cell_biology_B",
    "cell-biology-batch-c": "seed_batch_cell_biology_C",
    "organisation": "seed_unit_organisation",
    "infection-and-response": "seed_unit_infection_and_response",
    "bioenergetics": "seed_unit_bioenergetics",
    "homeostasis-and-response": "seed_unit_homeostasis_and_response",
    "inheritance-variation-evolution": "seed_unit_inheritance_variation_evolution",
    "ecology": "seed_unit_ecology",
    "all": "seed_all",
  };

  const scriptName = scopeToRunner[scope];
  if (!scriptName) {
    return res.status(400).json({
      ok: false,
      msg: `Invalid scope. Allowed: ${Object.keys(scopeToRunner).join(", ")}`,
    });
  }

  const scriptsDir = path.resolve(__dirname, "..", "scripts", "aqa_gcse_biology");
  let runFn;
  try {
    const mod = require(path.join(scriptsDir, scriptName + ".js"));
    runFn = mod.run;
    if (typeof runFn !== "function") {
      return res.status(500).json({ ok: false, msg: "Runner did not export run()" });
    }
  } catch (err) {
    console.error("[devTools] require runner failed:", err);
    return res.status(500).json({ ok: false, msg: err.message || "Failed to load runner" });
  }

  try {
    const results = await runFn(mongoose);
    return res.json({
      ok: true,
      scope,
      results: Array.isArray(results) ? results : [{ topic: scope, inserted: 0, skipped: false }],
    });
  } catch (err) {
    console.error("[devTools] seed error:", err);
    return res.status(500).json({
      ok: false,
      scope,
      msg: err.message || "Seed failed",
    });
  }
});

module.exports = router;
