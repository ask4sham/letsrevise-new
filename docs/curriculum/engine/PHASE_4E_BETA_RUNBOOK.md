# Phase 4E — Beta Runbook (Slot Generation)

This runbook is the operational procedure for running Beta safely.
It assumes all Phase 4C/4D guards are already locked (kill-switch, allowAI, allowlist, rollout percent, telemetry schema).

## Scope
This runbook governs:
- Enabling/disabling the real OpenAI execution path
- Allowlist + rollout changes
- Verification steps (telemetry + schema validation)
- Rollback / halt actions

No runtime behavior should be changed without updating the Phase 4D rollout contract and these procedures.

---

## Required controls (hard gates)
Beta is only allowed when ALL are true:
1. FEATURE flag enabled (e.g. `FEATURE_SLOTGEN_AI=true`)
2. Kill-switch is NOT active (`SLOTGEN_AI_KILL != "true"`)
3. Job explicitly opts in (`metadata.allowAI === true`)
4. Allowlist permits the job (policy match)
5. Rollout gate admits the job (deterministic bucket within `%`)

If any gate fails, executor must return the schema-valid STUB path and emit telemetry that explains why.

---

## Pre-flight checklist (before enabling any exposure)
Confirm:
- CI is green on `main`
- Allowlist config is schema-valid and deny-by-default unless intentionally enabled
- Telemetry validation step is present in CI
- Kill-switch dominance check is present in CI
- Enabled-path test uses a stubbed server (no real network in CI)

---

## Safe enable sequence (recommended)
Perform changes in this order:
1. Keep `SLOTGEN_AI_KILL=true` (hard stop), even if you enable feature/allowlist/rollout.
2. Enable allowlist policy file (`enabled: true`) with the smallest possible rule set.
3. Set rollout percent to a small value (e.g. 1–5).
4. Only then remove the kill-switch in the target environment.

This ensures gates are exercised without accidentally calling the model.

---

## Rollout adjustments
When increasing exposure:
- Change only ONE dimension at a time:
  - Increase rollout percent OR
  - Broaden allowlist rules OR
  - Expand which jobs set `allowAI`
- Observe telemetry and error rates before proceeding.

---

## Halt / rollback (immediate)
If anything looks wrong (cost spike, errors, bad outputs):
1. Set `SLOTGEN_AI_KILL=true` (dominates everything)
2. Optionally set rollout percent to `0` and/or disable allowlist (`enabled: false`)
3. Investigate using telemetry (errorCode + status + latencyMs)

Kill-switch is the primary emergency brake.

---

## Success criteria for “Beta stable”
Beta is considered stable when:
- Telemetry shows expected distribution of STUB vs COMPLETED for admitted jobs
- No schema validation failures for outputs
- ErrorCode rates are understood and acceptable
- Latency is within expected bounds for admitted jobs
- Rollback has been tested (kill-switch) and behaves deterministically

---

## Notes
- CI must never require real OpenAI network access.
- The executor must remain schema-locked end-to-end.
- Any change to gates or semantics must be reflected in Phase 4D rollout contract and verified by CI.
