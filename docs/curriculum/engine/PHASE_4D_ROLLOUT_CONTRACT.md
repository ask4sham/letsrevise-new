# Phase 4D — Slot Generation Rollout Contract (Locked)

This document defines the **authoritative rollout contract** for the Phase 4D
slot-generation system. It describes how AI execution is permitted, gated,
rolled out, and observed.

This document is **documentation-only**, but its contents are enforced by
runtime guards and CI tests. Changes here must always correspond to deliberate
code + CI updates.

---

## 1. Inputs That Affect AI Execution

The following inputs are evaluated to determine whether the OpenAI executor
may run:

### Environment Flags
- `FEATURE_SLOTGEN_AI` — enables the AI path (default: off)
- `SLOTGEN_AI_KILL` — hard kill-switch; always forces STUB
- `SLOTGEN_AI_ROLLOUT_PERCENT` — rollout percentage (0–100)

### Job Metadata
- `metadata.allowAI` — explicit per-job opt-in (required)

### Allowlist Policy
- Versioned allowlist config
- `enabled` flag
- Rule match on:
  - subject
  - level
  - board
  - specVersion
  - job kind

---

## 2. Decision Order (Authoritative)

AI execution is determined in the **exact order below**.
Earlier rules always dominate later ones.

1. **Kill-switch**
   - If `SLOTGEN_AI_KILL=true`
   - → Always return `STUB`

2. **Feature flag**
   - If `FEATURE_SLOTGEN_AI != true`
   - → `STUB`

3. **Explicit job opt-in**
   - If `metadata.allowAI != true`
   - → `STUB` (`NOT_ALLOWLISTED`)

4. **Allowlist**
   - If allowlist is disabled
   - OR no rule matches the job
   - → `STUB` (`NOT_ALLOWLISTED`)

5. **Rollout gate**
   - If `SLOTGEN_AI_ROLLOUT_PERCENT == 0`
     - Rollout gate is disabled (all allowed)
   - Else:
     - Deterministic bucket from `jobId`
     - If bucket ≥ rollout percent
       - → `STUB` (`ROLLOUT_EXCLUDED`)

6. **AI execution**
   - Only reached if all prior checks pass
   - → Real OpenAI call allowed

---

## 3. Possible Outcomes

### STUB
Returned when:
- Kill-switch is active
- Feature flag is off
- `allowAI` is false or missing
- Allowlist denies the job
- Job is excluded by rollout

### COMPLETED
Returned when:
- All gates pass
- OpenAI execution succeeds
- Output validates against result schema

### Telemetry Error Codes
- `KILL_SWITCH`
- `NOT_ALLOWLISTED`
- `ROLLOUT_EXCLUDED`
- OpenAI execution errors (HTTP, non-JSON, schema failure)

---

## 4. Hard Invariants (Must Never Change)

- **Deny-by-default**: AI is never allowed implicitly
- **Deterministic per jobId**
  - Same jobId → same rollout decision
- **Schema-locked**
  - Inputs, outputs, telemetry
- **CI-enforced**
  - Kill-switch dominance
  - Allowlist behavior
  - Rollout determinism
- **No side effects**
  - STUB path produces no AI calls

Any change to these invariants requires:
1. Explicit design approval
2. Code changes
3. CI updates
4. Documentation update

---

## 5. What Phase 4E Is Allowed to Change

✅ Allowed:
- Rollout percentage
- Allowlist rules
- Model configuration
- Prompt content

❌ Not allowed:
- Decision order
- Default behavior
- Determinism guarantees
- Kill-switch dominance
- Schema contracts

---

## Definition of Done

Phase 4D is complete when:
- All behavior above is implemented
- CI enforces every gate
- Rollout is deterministic and observable
- This contract matches runtime behavior exactly

✅ Stop here

After this file is saved:

Commit

Push to main

Phase 4D is DONE
