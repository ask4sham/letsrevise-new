# Phase 4E — Beta Monitoring & Halt Signals (Slot Generation)

This document defines the monitoring contract for Phase 4E Beta so exposure can
be observed, paused, or halted deterministically.

This is a docs-only contract. No runtime behavior, CI, or implementation logic
is changed by this document.

---

## Required Beta Metrics

During Beta, the following metrics must be tracked continuously:

- completion rate
- STUB vs COMPLETED ratio
- errorCode distribution
- latency percentiles (p50 / p95)

These metrics are required to evaluate rollout health and operator response.

---

## Hard Stop Conditions (Any One Halts Beta)

Beta must be halted immediately if any of the following is observed:

- schema validation failure
- telemetry missing
- unexpected errorCode
- latency regression beyond threshold

When a hard stop condition is triggered, rollout expansion must cease and
operators must move to a safe state.

---

## Manual Kill Paths

Operators must always be able to stop Beta exposure using either:

- `SLOTGEN_AI_KILL=true`
- rollout percent = 0

Both controls are manual and intended for immediate risk containment.

---

## Rollout Expansion Policy

No automatic expansion. All rollout changes are manual and reversible.
