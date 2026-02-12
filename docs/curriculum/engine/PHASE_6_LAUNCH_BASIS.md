# Phase 6 — Beta Launch Basis Snapshot (Slot Generation)

This file records the exact repository basis for the Beta launch sequence.
It must only change by an explicit Phase 6 decision and a new lock tag.

## Git basis (must match)

HEAD:
4995d90064e09ec51c4abd312633dbbdc43c9c37

## Required locked tags present

### Phase 4E (Beta readiness)
- phase-4e-beta-entry-checks
- phase-4e-beta-exit-criteria
- phase-4e-beta-monitoring-locked
- phase-4e-beta-ready
- phase-4e-beta-runbook-locked

### Phase 4F (Beta launch governance)
- phase-4f-beta-go-no-go-locked
- phase-4f-beta-launch-checklist-locked
- phase-4f-beta-launch-ready

### Phase 5 (Enable plan locked)
- phase-5-beta-enable-ci-locked
- phase-5-beta-enable-plan-locked

## Invariant
If any required tag above is missing, moved, or does not point to the intended commit history,
STOP: do not proceed with Phase 6 runtime actions.
