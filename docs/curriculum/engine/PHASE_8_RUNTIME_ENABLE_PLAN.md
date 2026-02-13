# Phase 8 — Runtime Enablement Plan (Controlled Canary)

Phase 8 defines the **exact, safe order** for enabling real OpenAI slot generation in runtime.
This phase is **ops-only** (runtime flags/config), and exists to prevent ad-hoc enablement.

## Preconditions (must already be true)
- You are on `main`, clean working tree.
- Phase 7 is locked (verification scripts + tags exist).
- Kill-switch dominance is proven:
  - `SLOTGEN_AI_KILL=true` forces STUB even if feature is on.
- Default path remains STUB unless explicitly permitted by:
  1) `FEATURE_SLOTGEN_AI=true`
  2) `metadata.allowAI === true`
  3) allowlist permits the job (deny-by-default)
  4) rollout percent includes the jobId bucket
  5) kill-switch is **off**

## Decision order (authoritative)
The OpenAI executor must decide in this order:

1. **Kill-switch**  
   If `SLOTGEN_AI_KILL=true` → STUB  
   Telemetry: `path="stub"`, `errorCode="KILL_SWITCH"`.

2. **Feature flag**  
   If `FEATURE_SLOTGEN_AI!=true` → STUB  
   Telemetry: `path="stub"`, `errorCode=null`.

3. **Explicit per-job canary**  
   If `metadata.allowAI !== true` → STUB  
   Telemetry: `path="stub"`, `errorCode="NOT_ALLOWLISTED"` (policy denied).

4. **Allowlist policy** (deny-by-default)  
   If allowlist disabled or no rule matches → STUB  
   Telemetry: `path="stub"`, `errorCode="NOT_ALLOWLISTED"`.

5. **Rollout gating** (deterministic)  
   If `SLOTGEN_AI_ROLLOUT_PERCENT` excludes jobId bucket → STUB  
   Telemetry: `path="stub"`, `errorCode="ROLLOUT_EXCLUDED"`.

6. **OpenAI call** (only if all gates pass)  
   → COMPLETED  
   Telemetry: `path="openai"`, `status="COMPLETED"`.

## Phase 8 rollout stages (runtime-only)
Stage 0 — Safe baseline
- `FEATURE_SLOTGEN_AI=false` (or unset)
- Allowlist may be enabled/disabled; no effect without feature + allowAI.
- Expected: always STUB.

Stage 1 — Internal canary (single scope, 1% or 5%)
- Enable feature flag in the target environment.
- Enable allowlist (still deny-by-default except explicit rule set).
- Set `SLOTGEN_AI_ROLLOUT_PERCENT=1` (or 5).
- Only jobs with `metadata.allowAI=true` and allowlist match are eligible.
- Kill-switch remains available as immediate stop.

Stage 2 — Expand within same scope (10% → 25% → 50%)
- Increase `SLOTGEN_AI_ROLLOUT_PERCENT` gradually.
- Do not expand allowlist scope and rollout percent simultaneously.
- Require telemetry review at each step.

Stage 3 — Broaden allowlist scope (still gradual)
- Expand allowlist rules (one dimension at a time: subject/board/level).
- Keep rollout percent stable during policy expansion.

Stage 4 — Beta steady-state
- Defined by Phase 4E/4F criteria (monitoring + exit/rollback).
- Continue using kill-switch + telemetry invariants.

## Required runtime verification at each change
For every enablement or expansion:
- Confirm executor outputs remain schema-valid.
- Confirm telemetry is emitted (single-line JSON to stderr).
- Confirm `path="openai"` only occurs when gates permit.
- Confirm kill-switch immediately forces STUB.

## Rollback (must be instant, no code changes)
Primary:
- Set `SLOTGEN_AI_KILL=true` (forces STUB everywhere immediately)

Secondary (if needed):
- Set `SLOTGEN_AI_ROLLOUT_PERCENT=0` (no gating; treat as off per current semantics) OR set to a low value
- Disable allowlist or remove matching rules
- Set `FEATURE_SLOTGEN_AI=false`

## Definition of done (Phase 8 plan)
- This document is committed to `main`.
- The enablement order is explicit and matches the executor behavior proven in Phase 7.
- No runtime settings have been changed as part of creating this plan.
