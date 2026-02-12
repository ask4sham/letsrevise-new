# Phase 4E — Beta Exit & Rollback Criteria (Slot Generation)

This document defines the authoritative exit conditions for the Phase 4E Beta of slot generation.
It ensures Beta exposure can be halted or rolled back deterministically, safely, and without ambiguity.

This is a **contract document** only. No runtime or CI behavior is changed here.

---

## Scope

These criteria apply only to:
- Slot generation via the Phase 4C OpenAI executor
- When rollout is enabled via allowlist + rollout gating
- During Phase 4E Beta only

---

## Beta Failure Conditions (Immediate Exit)

Beta must be halted immediately if **any** of the following occur:

1. **Schema violation**
   - Any OpenAI-generated output fails validation against
     `slot-generation-result.v1.schema.json`.

2. **Non-deterministic behavior**
   - The same jobId produces different outcomes under identical
     inputs, rollout percentage, and environment flags.

3. **Kill-switch failure**
   - `SLOTGEN_AI_KILL=true` does not force the STUB path.

4. **Telemetry regression**
   - Missing telemetry record
   - Invalid telemetry schema
   - Incorrect `errorCode` for STUB or failure paths

5. **Unauthorized execution**
   - OpenAI path executes when:
     - allowlist is disabled, or
     - metadata.allowAI is false, or
     - rollout gating excludes the job

---

## Rollback Triggers (Operator-Initiated)

Rollback may be initiated by operators if any of the following are observed:

- Elevated failure rate attributable to model behavior
- Latency regressions outside expected bounds
- Content quality regressions flagged by reviewers
- Unexpected OpenAI HTTP or parsing errors at scale

Rollback is executed by:
- Setting `SLOTGEN_AI_KILL=true`, or
- Setting rollout percent to `0`, or
- Disabling the allowlist

No code deployment is required to roll back.

---

## Explicit Non-Rollback Conditions

The following **do not** qualify as Beta failure:

- STUB execution due to rollout exclusion
- STUB execution due to allowlist mismatch
- STUB execution due to missing metadata.allowAI
- Individual job rejection due to schema-invalid input

These are expected and correct behaviors.

---

## Definition of Beta Exit (Success)

Phase 4E Beta may be considered **successfully complete** when:

- All CI guards remain green
- Telemetry remains schema-valid
- Rollout gating behaves deterministically
- No rollback triggers occur during the Beta window

At that point, promotion to Phase 5 (General Availability planning)
may be considered.

---

## Status

- Phase: **4E**
- Nature: **Docs-only**
- Runtime impact: **None**
- CI impact: **None**
