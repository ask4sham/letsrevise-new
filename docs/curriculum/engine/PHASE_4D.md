# Phase 4D — Slot Generation Rollout (Controlled Exposure)

Phase 4C delivered a guarded OpenAI executor:
- Default path remains STUB
- OpenAI path requires explicit opt-in
- Kill-switch dominates
- Telemetry is schema-locked
- CI enforces invariants

Phase 4D defines how we safely roll this into real usage.

---

## Current hard gates (already enforced)

OpenAI execution is allowed ONLY when all are true:
1) FEATURE_SLOTGEN_AI === "true"
2) SLOTGEN_AI_KILL !== "true"
3) job.metadata.allowAI === true

Otherwise: STUB.

---

## Rollout stages

### Stage 0 — Internal only (default)
- FEATURE_SLOTGEN_AI may be on in dev/staging
- Production stays STUB for all jobs (no allowAI jobs created)
- Purpose: verify plumbing, telemetry, and safeguards

### Stage 1 — Canary (explicit allowAI + allowlist)
- Only jobs that explicitly set metadata.allowAI=true
- AND match an allowlist rule (Phase 4D adds this)
- Purpose: tiny exposure with full auditability

### Stage 2 — Limited cohort / percentage
- Expand allowlist OR introduce % routing for allowAI jobs
- Maintain kill-switch dominance
- Purpose: gather performance + quality metrics

### Stage 3 — Broad rollout (still gated)
- Allow AI for most allowAI jobs
- Keep STUB fallback and kill-switch
- Purpose: scale generation safely

---

## Required controls before Stage 1 is enabled

1) Allowlist gate
- A server-side / executor-side rule must decide whether an allowAI job is permitted (e.g. subject/board/specVersion/job kind).

2) Budget guard
- Hard cap on calls per run (and/or per job batch).
- Hard cap on max tokens.

3) Failure policy
- Any OpenAI error => return FAILED (schema-valid) OR fall back to STUB (explicitly chosen and documented).
- Never emit partial / non-schema output.

4) Telemetry thresholds (abort conditions)
- Error rate threshold
- Latency ceiling
- Output schema failure rate must be 0 (schema is the contract)

5) Kill-switch runbook
- Document exact env toggle + expected effect
- Confirm CI enforces dominance

---

## Non-goals for Phase 4D
- No DB/job queue yet (that’s a later phase if needed)
- No user-facing UX rollout
- No background processing
- No streaming responses

---

## Definition of Done (Phase 4D)
- Allowlist gate implemented and CI-locked
- Budget guard implemented and CI-locked
- Failure policy explicitly chosen and enforced
- Rollout stages documented and tagged

