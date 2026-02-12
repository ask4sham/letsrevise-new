# Phase 5 — Beta Enable Plan (Controlled Runtime)

This document defines the operational plan for enabling Beta at runtime in a
controlled, reversible manner.

It is a planning artifact only.

**No code changes in Phase 5 Step 1.**

---

## Runtime Flags Used for Beta Enablement

The following runtime controls define Beta exposure:

- `FEATURE_SLOTGEN_AI`
  - Enables/disables the AI execution path.
- `SLOTGEN_AI_KILL`
  - Global emergency stop; forces STUB when set to `true`.
- `SLOTGEN_AI_ROLLOUT_PERCENT`
  - Deterministic exposure percentage for allowlisted + eligible jobs.
- Allowlist configuration (`slot-generation-allowlist.v1.json` or approved override path)
  - Controls which jobs are policy-eligible.

---

## Allowed Change Order (Strict)

Beta enablement changes must occur in this exact order:

1. Confirm kill-switch is ON (`SLOTGEN_AI_KILL=true`).
2. Confirm feature flag state for target environment (`FEATURE_SLOTGEN_AI=true`) while kill-switch remains ON.
3. Enable allowlist with minimal cohort rule set (smallest safe scope).
4. Set rollout percent to initial canary value (`0 -> 1 -> 5` progression only when stable).
5. Verify telemetry/health after each step.
6. Only after all checks pass, disable kill-switch (`SLOTGEN_AI_KILL=false`) to allow admitted traffic.

No step may be skipped, reordered, or combined.

---

## Change Authorization

Only designated release operators may modify Beta runtime controls:

- Engineering owner for slot generation runtime
- On-call operator with production access
- Product/operations approver (for rollout increases)

All changes must be:

- logged with timestamp and operator identity
- linked to the release decision record
- reversible within one operator action

---

## Verification After Each Change

After each runtime control change, verify:

- Executor status remains schema-valid.
- Telemetry is emitted and schema-valid.
- Expected path behavior is observed:
  - `stub` when blocked
  - `openai` only when all gates pass
- Error code distribution is expected (`KILL_SWITCH`, `NOT_ALLOWLISTED`,
  `ROLLOUT_EXCLUDED`, or expected OpenAI path outcomes).
- Latency remains within accepted bounds for current rollout level.

If any check fails, halt progression and execute rollback controls immediately.

---

## Explicit Non-Goals for Step 1

- Do not flip production flags.
- Do not widen allowlist scope.
- Do not increase rollout in runtime environments.
- Do not modify CI workflows.
- Do not modify runtime code.

This step establishes only the plan and governance for controlled Beta enablement.
