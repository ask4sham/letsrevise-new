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

/** When false (default): reject endpoint and canReject are disabled. Independent of generation. */
function isMcqRationaleCandidateRejectV23b2bEnabled() {
  return isTruthyEnv("FEATURE_MCQ_RATIONALE_CANDIDATE_REJECT_V23B2B");
}

/**
 * When false (default): Attempt-2 replacement endpoint is disabled.
 * Requires FEATURE_MCQ_RATIONALE_BACKFILL_V23A as well for provider generation.
 * Does not enable generic Attempt 1 create for rejected lineages.
 */
function isMcqRationaleReplacementV23b2b2Enabled() {
  return isTruthyEnv("FEATURE_MCQ_RATIONALE_REPLACEMENT_V23B2B2");
}

function getMcqRationaleBackfillActorDailyCap() {
  const n = Number(process.env.MCQ_RATIONALE_BACKFILL_ACTOR_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
}

function getMcqRationaleBackfillGlobalDailyCap() {
  const n = Number(process.env.MCQ_RATIONALE_BACKFILL_GLOBAL_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
}

/**
 * Generation lease duration.
 * Provider helper timeout is 120s; service wrapper uses 60s; max 2 sequential calls.
 * Default 10 minutes covers 2×120s plus DB/safety margin.
 * Bounds: min 2 minutes, max 30 minutes.
 */
const DEFAULT_GENERATION_LEASE_MS = 10 * 60 * 1000;
const MIN_GENERATION_LEASE_MS = 2 * 60 * 1000;
const MAX_GENERATION_LEASE_MS = 30 * 60 * 1000;

function getMcqRationaleGenerationLeaseMs() {
  const raw = process.env.MCQ_RATIONALE_GENERATION_LEASE_MS;
  if (raw == null || String(raw).trim() === "") return DEFAULT_GENERATION_LEASE_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_GENERATION_LEASE_MS;
  const ms = Math.floor(n);
  if (ms < MIN_GENERATION_LEASE_MS) return MIN_GENERATION_LEASE_MS;
  if (ms > MAX_GENERATION_LEASE_MS) return MAX_GENERATION_LEASE_MS;
  return ms;
}

module.exports = {
  isTruthyEnv,
  isMcqRationaleBackfillV23aEnabled,
  isMcqRationaleBackfillPublishedAllowed,
  isMcqRationaleCandidateRejectV23b2bEnabled,
  isMcqRationaleReplacementV23b2b2Enabled,
  getMcqRationaleBackfillActorDailyCap,
  getMcqRationaleBackfillGlobalDailyCap,
  getMcqRationaleGenerationLeaseMs,
  DEFAULT_GENERATION_LEASE_MS,
  MIN_GENERATION_LEASE_MS,
  MAX_GENERATION_LEASE_MS,
};
