# Phase 4F — Beta Go / No-Go Decision Record (Slot Generation)

## Purpose

This document is the authoritative decision record for Beta launch readiness of
slot generation. It captures whether launch is approved ("GO"), paused
("HOLD"), or rejected ("NO-GO") based on the locked Phase 4E and Phase 4F
contracts.

This is documentation-only. No runtime or CI behavior is changed here.

---

## Preconditions (Required Milestones)

Beta GO may only be considered when the following milestone tags exist and are
anchored to the intended release history:

- `phase-4c-openai-guarded`
- `phase-4d-rollout-contract-locked`
- `phase-4d-rollout-tests-locked`
- `phase-4e-beta-entry-checks`
- `phase-4e-beta-ready`
- `phase-4e-beta-exit-criteria`
- `phase-4e-beta-monitoring-locked`
- `phase-4e-beta-runbook-locked`
- `phase-4f-beta-launch-checklist-locked`

If any required tag is missing or points to an unintended commit, decision
status is automatically **HOLD**.

---

## GO Conditions (All Must Be True)

- `main` is green and synchronized with `origin/main`.
- Phase 4E contracts are present and current:
  - Beta definition
  - Beta entry checks
  - Beta exit and rollback criteria
  - Beta monitoring and halt signals
  - Beta runbook
- Phase 4F launch checklist is locked and validated against current `HEAD`.
- Runtime gating contract remains unchanged:
  - kill-switch dominance
  - explicit `allowAI` opt-in
  - allowlist enforcement (deny-by-default)
  - deterministic rollout gating
  - schema-locked output and telemetry
- Operators confirm rollback controls are available and understood.

When all conditions are true, status may be set to **GO**.

---

## NO-GO / HOLD Conditions

Decision status must be **NO-GO** or **HOLD** if any of the following apply:

- Any required milestone tag is missing, stale, or mis-anchored.
- CI is not green on `main`.
- Contracts are incomplete, inconsistent, or out of date.
- Monitoring and halt signals are not operationally understood.
- Rollback controls are unavailable, untested, or unclear.
- Any unresolved blocker exists in Beta entry/exit criteria.

Use **HOLD** when issues are remediable in current phase, and **NO-GO** when
launch should not proceed without explicit re-approval.

---

## Rollback Reference

Rollback execution and trigger criteria are governed by:

- `docs/curriculum/engine/PHASE_4E_BETA_EXIT_CRITERIA.md`
- `docs/curriculum/engine/PHASE_4E_BETA_RUNBOOK.md`

If Beta must be halted after GO, operators must follow those documents exactly.

---

## Signature Block (Human Authorization)

Decision: `GO` / `HOLD` / `NO-GO`

- Date:
- Commit SHA evaluated:
- Approved by (Engineering):
- Approved by (Product/Operations):
- Notes / Constraints:

This decision is human-authorized and must not be inferred automatically.
