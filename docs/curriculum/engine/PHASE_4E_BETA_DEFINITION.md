# Phase 4E — Beta Definition for Slot Generation

This document defines what "Beta-ready" means for slot generation in concrete,
testable terms. It is a contract for release readiness and scope control during
Phase 4E.

This is a documentation-only definition. It does not introduce implementation
changes.

---

## 1) Beta-Ready Qualification

Slot generation is Beta-ready only when all of the following are true:

- The execution contract is schema-locked end-to-end:
  - input schema
  - output schema
  - telemetry schema
  - allowlist schema
- Runtime gating behavior is deterministic and observable:
  - kill-switch dominance
  - feature flag gating
  - explicit per-job opt-in (`metadata.allowAI`)
  - allowlist enforcement (deny-by-default)
  - deterministic rollout gating by `jobId`
- Telemetry is emitted for every executor decision path and can be used to
  explain why AI did or did not run.
- Safe fallback behavior is always available (`STUB`) without side effects.
- Operational controls exist and are documented:
  - on/off capability via feature flag
  - immediate shutdown via kill-switch
  - exposure control via rollout percentage
  - policy control via allowlist

---

## 2) Required Invariants (Must Hold Throughout Beta)

The following invariants are mandatory and non-negotiable in Beta:

- **Schema invariants**
  - All contracts remain versioned and validated.
  - Executor outputs remain contract-compatible at all times.
- **Gating invariants**
  - Deny-by-default is preserved.
  - Kill-switch always overrides all other gates.
  - No AI call occurs unless all gates pass.
- **Telemetry invariants**
  - Decision outcomes are machine-readable and attributable.
  - Exclusion reasons remain explicit (for example, policy vs rollout vs kill).
- **Rollout invariants**
  - Rollout decision is deterministic for a given `jobId`.
  - Same `jobId` always yields the same rollout inclusion/exclusion at a fixed
    rollout percentage.
- **Safety invariants**
  - Stub path produces no model side effects.
  - Failure paths are fail-safe and remain observable.

---

## 3) Explicitly Allowed in Beta

The following changes are allowed during Beta:

- Increase or decrease rollout percentage.
- Modify allowlist rules and policy scope.
- Tune model configuration and prompt content.
- Improve monitoring, dashboards, and operator visibility.
- Add or tighten tests that reinforce existing invariants.
- Improve internal quality (refactors) without changing contract behavior.

---

## 4) Explicitly Forbidden in Beta

The following are out of scope and forbidden during Beta:

- Reordering or weakening gate precedence.
- Disabling deny-by-default behavior.
- Removing kill-switch dominance.
- Introducing nondeterministic rollout behavior.
- Breaking schema compatibility for input, output, telemetry, or allowlist.
- Silent execution paths without telemetry.
- Expanding blast radius through hidden defaults or implicit opt-in.

---

## 5) Exit Criteria: Beta -> GA

Promotion from Beta to GA requires all of the following:

- Sustained operational stability over an agreed observation window.
- No unresolved Sev-1 or Sev-2 defects in slot-generation runtime behavior.
- Confirmed correctness of gating outcomes in production-like traffic.
- Deterministic rollout behavior verified under real operational conditions.
- Telemetry completeness sufficient for incident triage and auditability.
- Documented operator runbook covering:
  - rollout changes
  - kill-switch operation
  - allowlist updates
  - incident rollback actions
- Product and engineering sign-off that:
  - quality targets are met
  - safety targets are met
  - observability targets are met
  - support readiness is in place

Only when all exit criteria are satisfied can Phase 4E be considered complete
and GA promotion approved.
