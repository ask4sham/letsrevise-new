# Phase 4E — Beta Entry Checks (Slot Generation)

This document turns the Phase 4E “Beta Definition” into concrete, verifiable entry checks.
It is intentionally **docs-only**: no runtime behavior changes are introduced by this phase.

## What “Beta Entry” means

Beta starts when **all checks in this doc are true** on `main`:
- CI is green.
- The OpenAI executor remains guarded (default STUB).
- Real OpenAI calls are still gated behind **all** runtime gates (feature + kill-switch + allowAI + allowlist + rollout).
- Output and telemetry contracts are schema-valid.

## Invariants (must always hold)

### 1) Output contract is stable
Every slot-generation executor output MUST validate against:

- `docs/curriculum/engine/slot-generation-result.v1.schema.json`

And the canonical example MUST validate too:

- `docs/curriculum/engine/slot-generation-result.contract.json`

### 2) Telemetry contract is stable
Every execution emits one telemetry JSON line to stderr (best-effort), which MUST validate against:

- `docs/curriculum/engine/slot-generation-telemetry.v1.schema.json`

### 3) Real OpenAI calls are never “accidental”
The OpenAI executor must **NOT** make real network calls unless explicitly permitted by gates.
At minimum, the following must remain true:

- Default path (no enable flags) => **STUB**
- Kill-switch dominates everything => **STUB**
- No explicit allowAI (canary gate) => **STUB**
- Allowlist disabled or mismatch => **STUB**
- Rollout excludes job => **STUB**

## Runtime gates (decision order)

When running the OpenAI executor, the system must behave as if the decision order is:

1. **Kill-switch dominates**
   - If `SLOTGEN_AI_KILL=true` => force **STUB** regardless of everything else.
2. **Feature flag**
   - If `FEATURE_SLOTGEN_AI` is not `"true"` => **STUB**.
3. **Canary gate**
   - If `metadata.allowAI !== true` => **STUB**.
4. **Allowlist gate**
   - If allowlist is disabled OR job does not match an allowlist rule => **STUB**.
5. **Rollout gate**
   - If job is deterministically excluded by `SLOTGEN_AI_ROLLOUT_PERCENT` => **STUB**.
6. Otherwise => **OpenAI path may run** (in CI this is exercised only via stubbed server).

Telemetry must reflect the chosen path (e.g. `path: "stub"`), and use stable error codes for stub reasons.

## CI checks required for Beta entry

All of these must be GREEN on `main`:

### A) General repo health
- Unit tests pass (`npm test`)
- Validate Curriculum Artifacts workflow passes (schemas, slotgen checks, etc.)

### B) Slotgen contracts
- Slot-generation job input schema validation is enforced.
- Slot-generation result schema validation is enforced.
- Result contract example validates against the result schema.
- Telemetry schema validation is enforced.

### C) Guarded executor behavior (no real calls by default)
CI must prove:
- Default OpenAI executor run returns **STUB** and is schema-valid.
- Enabled path is exercised only via **stubbed local server** (no outbound network).
- Kill-switch dominance is locked.
- Canary gate (`metadata.allowAI === true`) is required to even attempt OpenAI.
- Allowlist path override works (tests/CI do not depend on repo allowlist file state).
- Deterministic rollout behavior is locked (same jobId => same outcome).

## Local verification commands (optional)

From repo root:

- Run the full suite:
  - `npm test`

- Run only the OpenAI executor tests:
  - `npm test -- --testPathPatterns="scripts/__tests__/run-slot-generation-openai.test.js"`

Note: On Windows PowerShell, pass JSON via single quotes to avoid escaping issues.

## Beta entry sign-off

Beta entry is approved when:
- All CI checks above are green on `main`.
- No runtime behavior changes were needed to satisfy the checks.
- The gating contract (decision order + invariants) is understood and agreed.

This document is part of the release contract: if a future change violates any check above, it is a Beta blocker.
