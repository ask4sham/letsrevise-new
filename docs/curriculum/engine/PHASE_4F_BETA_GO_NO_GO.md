# Phase 4F — Beta GO / NO-GO Decision Record (Slot Generation)

This document is the **authoritative human decision record** for opening the Slot Generation system to **Beta exposure**.
It is intentionally **docs-only**: it does not change runtime behavior, CI, or gating code.

---

## Scope

This decision covers **Beta exposure** of the Phase 4C OpenAI executor behind the Phase 4D rollout controls:

- Kill-switch dominance (SLOTGEN_AI_KILL)
- Canary gate (metadata.allowAI)
- Allowlist policy (deny-by-default; schema-locked)
- Deterministic rollout gate (SLOTGEN_AI_ROLLOUT_PERCENT)

---

## Required milestone tags (must already exist)

The following tags must exist in `origin` and represent the locked milestones this decision relies on:

### Phase 4E (Beta readiness contracts)
- `phase-4e-beta-ready`
- `phase-4e-beta-entry-checks`
- `phase-4e-beta-exit-criteria`
- `phase-4e-beta-monitoring-locked`
- `phase-4e-beta-runbook-locked`

### Phase 4F (Beta launch checklist locked + verified)
- `phase-4f-beta-launch-checklist-locked`

### Phase 4D (rollout controls locked)
- `phase-4d-rollout-contract-locked`
- `phase-4d-rollout-tests-locked`

### Phase 4C (OpenAI executor guarded)
- `phase-4c-openai-guarded`

If any tag above is missing, **NO-GO** until resolved.

---

## GO conditions (all must be true)

### 1) CI is green on `main`
- GitHub Actions checks for `main` show **success** for:
  - curriculum validation workflow (schemas / contracts / slotgen checks)
  - build/test workflow(s)

### 2) Default runtime remains safe
- With **no feature flags set**, the OpenAI executor path remains **STUB** (no model calls).
- With `FEATURE_SLOTGEN_AI=true` but without `metadata.allowAI===true`, the path remains **STUB**.
- With `SLOTGEN_AI_KILL=true`, the path is **forced STUB** regardless of other flags.

### 3) Enablement path is controlled + deterministic
- With allowlist enabled + matching rule + `metadata.allowAI===true`,
  enablement is still gated by `SLOTGEN_AI_ROLLOUT_PERCENT` deterministically by `jobId`.
- With a stubbed local server in CI, the enabled path produces schema-valid output and expected status.

### 4) Telemetry is present and schema-valid
- Executions emit one telemetry JSON line to stderr that validates against:
  - `docs/curriculum/engine/slot-generation-telemetry.v1.schema.json`
- Telemetry clearly distinguishes:
  - `path: "stub"` vs `path: "openai"`
  - `status` and `errorCode` for denied/blocked cases

### 5) Rollback is clear and immediate
- Beta rollback actions are explicitly defined in:
  - `docs/curriculum/engine/PHASE_4E_BETA_EXIT_CRITERIA.md`
- Operators can force safe behavior immediately via:
  - `SLOTGEN_AI_KILL=true`

---

## NO-GO / HOLD conditions (any one triggers NO-GO)

- Any required tag is missing from the list above.
- CI is not green on `main`.
- Any evidence that the OpenAI path can execute without:
  - allowAI canary gate AND allowlist permission AND rollout permit
- Kill-switch does not dominate.
- Output or telemetry fails schema validation.
- Monitoring signals indicate elevated risk per:
  - `docs/curriculum/engine/PHASE_4E_BETA_MONITORING.md`

---

## Decision

- Decision status: **GO** / **NO-GO** / **HOLD**
- Effective date/time (UTC):
- Authorized by (name + role):
- Notes (optional):

---

## Rollback plan (must reference the contract)

Rollback must follow:
- `docs/curriculum/engine/PHASE_4E_BETA_EXIT_CRITERIA.md`

Immediate safety action (first response):
- Set `SLOTGEN_AI_KILL=true` (forces STUB)

---

## Verification checklist (fill in at decision time)

- [ ] All required tags exist in origin (Phase 4C/4D/4E/4F listed above)
- [ ] CI is green on main
- [ ] Default path is STUB (no model calls)
- [ ] allowAI canary gate enforced
- [ ] allowlist gating enforced (deny-by-default)
- [ ] rollout gating enforced (deterministic by jobId)
- [ ] telemetry emitted + schema-valid
- [ ] rollback steps confirmed and practiced

---

## Sign-off

I confirm the GO/NO-GO decision above is based on the locked contracts and milestones referenced here.

Name:
Role:
Signature:
Date (UTC):
