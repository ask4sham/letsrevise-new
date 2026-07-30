/**
 * V2.3A MCQ rationale backfill feature flags.
 * Both default OFF — merging cannot spend AI credits or touch published questions.
 */

function isTruthyEnv(name) {
  const raw = process.env[name];
  if (raw == null) return false;
  const s = String(raw).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/** When false: endpoint is disabled; no reservation; no LLM. */
function isMcqRationaleBackfillV23aEnabled() {
  return isTruthyEnv("FEATURE_MCQ_RATIONALE_BACKFILL_V23A");
}

/** When false (default): only draft Composite MCQs may generate candidates. */
function isMcqRationaleBackfillPublishedAllowed() {
  return isTruthyEnv("MCQ_RATIONALE_BACKFILL_ALLOW_PUBLISHED");
}

function getMcqRationaleBackfillActorDailyCap() {
  const n = Number(process.env.MCQ_RATIONALE_BACKFILL_ACTOR_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
}

function getMcqRationaleBackfillGlobalDailyCap() {
  const n = Number(process.env.MCQ_RATIONALE_BACKFILL_GLOBAL_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
}

module.exports = {
  isTruthyEnv,
  isMcqRationaleBackfillV23aEnabled,
  isMcqRationaleBackfillPublishedAllowed,
  getMcqRationaleBackfillActorDailyCap,
  getMcqRationaleBackfillGlobalDailyCap,
};
