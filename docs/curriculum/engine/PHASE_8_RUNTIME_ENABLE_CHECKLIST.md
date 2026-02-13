# Phase 8 — Runtime Enable Checklist (Slot Generation)

This is the **authoritative, docs-only** checklist for enabling Slot Generation in production at runtime.
No code changes belong in Phase 8 — only controlled configuration changes and verification.

## Preconditions (must already be true)

- You are on `main` and clean (`git status` shows clean).
- Phase lock tags exist (do not proceed if any are missing):
  - Phase 4E: `phase-4e-beta-ready`
  - Phase 4F: `phase-4f-beta-launch-ready`
  - Phase 5: `phase-5-beta-enable-ci-locked` and `phase-5-beta-enable-plan-locked`
  - Phase 6: `phase-6-launch-basis-locked` and `phase-6-runtime-enable-checklist-locked`
  - Phase 7: `phase-7-locked` (and its lock tags)
  - Phase 8: `phase-8-runtime-enable-plan-locked`
- Kill-switch is available and known-good:
  - `SLOTGEN_AI_KILL=true` must force STUB regardless of feature/allowlist/rollout.
- Telemetry is schema-locked and flowing:
  - Telemetry includes: `executorVersion`, `jobId`, `path`, `status`, `latencyMs`, and optional `errorCode`.
- A rollback owner is on call and has access to flip the kill-switch immediately.

## Runtime controls (only these knobs)

- `FEATURE_SLOTGEN_AI=true|false`
- `SLOTGEN_AI_KILL=true|false` (hard override — must dominate)
- `SLOTGEN_ALLOWLIST_PATH=...` (optional override path; prod normally uses the canonical repo file)
- Allowlist config: enabled/deny-by-default + rules
- `SLOTGEN_AI_ROLLOUT_PERCENT=0..100` (deterministic per jobId)

## Decision order (must match implementation)

1. Kill-switch (`SLOTGEN_AI_KILL=true`) ⇒ **force STUB**
2. Feature flag off ⇒ **STUB**
3. allowAI not explicitly true ⇒ **STUB**
4. Allowlist disabled or not matched ⇒ **STUB** (errorCode: `NOT_ALLOWLISTED`)
5. Rollout excluded ⇒ **STUB** (errorCode: `ROLLOUT_EXCLUDED`)
6. Otherwise ⇒ OpenAI path ⇒ **COMPLETED** (or **FAILED** with errorCode)

## Enable sequence (controlled rollout)

### Stage A — Confirm safe default (no real calls)
- Set:
  - `FEATURE_SLOTGEN_AI=true`
  - `SLOTGEN_AI_KILL=true`
  - `SLOTGEN_AI_ROLLOUT_PERCENT=100`
  - Allowlist may be enabled/disabled — kill-switch must dominate.
- Verify:
  - Output stays **STUB**
  - Telemetry shows `path:"stub"` and `errorCode:"KILL_SWITCH"`

### Stage B — Allowlist gate works (still no exposure)
- Set:
  - `SLOTGEN_AI_KILL=false`
  - Allowlist `enabled:false` (deny-by-default)
  - `FEATURE_SLOTGEN_AI=true`
  - `SLOTGEN_AI_ROLLOUT_PERCENT=100`
  - Job includes `metadata.allowAI=true`
- Verify:
  - Output is **STUB**
  - Telemetry shows `errorCode:"NOT_ALLOWLISTED"` and `path:"stub"`

### Stage C — Deterministic rollout exclusion works
- Set:
  - Allowlist `enabled:true` with a rule that matches the test job
  - `FEATURE_SLOTGEN_AI=true`
  - `SLOTGEN_AI_ROLLOUT_PERCENT=30` (or any < 100)
  - Choose a jobId known to be excluded (per your deterministic bucket tests)
- Verify:
  - Output is **STUB**
  - Telemetry shows `errorCode:"ROLLOUT_EXCLUDED"` and `path:"stub"`

### Stage D — Minimal live exposure (first OpenAI calls)
- Set:
  - Allowlist `enabled:true` and matches target appliesTo/kind/slotId
  - `FEATURE_SLOTGEN_AI=true`
  - `SLOTGEN_AI_ROLLOUT_PERCENT=1` (start at 1%)
  - `SLOTGEN_AI_KILL=false`
- Verify:
  - Some requests become **COMPLETED** (OpenAI path)
  - Telemetry shows `path:"openai"` and `status:"COMPLETED"`
  - No unexpected schema validation failures

### Stage E — Gradual increase
Increase rollout in small steps (example): 1% → 5% → 10% → 25% → 50% → 100%
At each step verify:
- Error rate and latency remain acceptable
- `FAILED` telemetry errors are understood and within thresholds
- Rollback remains available

## Rollback (must be immediate)

If any GO/NO-GO condition fails:
- Set `SLOTGEN_AI_KILL=true` (force STUB immediately)
- Keep `FEATURE_SLOTGEN_AI=true` or turn it off — kill-switch already protects you
- Reduce `SLOTGEN_AI_ROLLOUT_PERCENT=0`
- Disable allowlist if needed
- Confirm telemetry returns to `path:"stub"` and `status:"STUB"` quickly

## Completion criteria (Phase 8 done)

- This checklist is committed on `main`.
- Operators can run Stages A–E and Rollback deterministically.
- Telemetry + schema validation remain green in CI and during controlled runs.
