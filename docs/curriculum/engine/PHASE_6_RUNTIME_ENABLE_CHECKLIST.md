# Phase 6 — Runtime Enable Checklist (Slot Generation Beta)

This is the authoritative, docs-only checklist for *runtime* enablement.  
No code changes belong in Phase 6.

## Preconditions (must already be true)

- You are on `main`, clean working tree, and `origin/main` is up to date.
- Phase tags exist:
  - Phase 4E: `phase-4e-beta-ready`
  - Phase 4F: `phase-4f-beta-launch-ready`
  - Phase 5: `phase-5-beta-enable-ci-locked`
  - Phase 6: `phase-6-launch-basis-locked`
- CI is green on `main`.
- You have a rollback owner + comms owner on-call.

## Safety invariants (do not bypass)

- **Kill-switch dominates**:
  - `SLOTGEN_AI_KILL=true` forces STUB even if anything else is enabled.
- **Canary gate required**:
  - AI is only permitted when `metadata.allowAI === true`.
- **Allowlist gate required**:
  - AI is only permitted when allowlist is enabled AND job matches allowlist.
  - Allowlist file may be overridden via `SLOTGEN_ALLOWLIST_PATH` (staging/testing).
- **Rollout gate (if used)**:
  - If rollout percent > 0, only some jobIds are eligible deterministically.
- Telemetry must emit a single-line JSON record to stderr (schema-validated in CI).

## Definitions (runtime flags)

- `FEATURE_SLOTGEN_AI`:
  - `"true"` enables the OpenAI path *subject to gates*.
  - Any other value keeps default path STUB.
- `SLOTGEN_AI_KILL`:
  - `"true"` forces STUB (dominates everything).
- `SLOTGEN_ALLOWLIST_PATH` (optional):
  - Points to an allowlist JSON file (staging/testing); prod should typically use the repo default.
- `SLOTGEN_AI_ROLLOUT_PERCENT` (optional):
  - `"0"` means no rollout gate (treat as fully eligible *if other gates allow*).
  - `"1"`..`"100"` enables deterministic rollout gating by jobId bucket.
- OpenAI creds / endpoint:
  - `OPENAI_API_KEY` required for real calls
  - `OPENAI_BASE_URL` optional (used for stub server / testing)

## Enablement order (strict)

### Stage 0 — Hard stop (baseline)
Goal: Prove we can always halt.

- Set:
  - `SLOTGEN_AI_KILL=true`
  - `FEATURE_SLOTGEN_AI=true` (optional; kill must still win)
- Expected:
  - Output: `status: "STUB"`
  - Telemetry: `path: "stub"`, `status: "STUB"`, `errorCode: "KILL_SWITCH"`

### Stage 1 — Feature on, still no AI (gate proving)
Goal: Prove feature-on does not call AI unless explicitly allowed.

- Set:
  - `SLOTGEN_AI_KILL=false`
  - `FEATURE_SLOTGEN_AI=true`
  - Allowlist disabled (or no matching rule)
  - Input job has `metadata.allowAI=false` (or missing)
- Expected:
  - Output: `status: "STUB"`
  - Telemetry: `path: "stub"`, `status: "STUB"`, `errorCode: "NOT_ALLOWLISTED"` (or equivalent deny reason)

### Stage 2 — Canary allowAI on, allowlist still denies
Goal: Prove allowAI alone is not sufficient.

- Set:
  - `SLOTGEN_AI_KILL=false`
  - `FEATURE_SLOTGEN_AI=true`
  - Input job has `metadata.allowAI=true`
  - Allowlist disabled (or mismatch)
- Expected:
  - Output: `status: "STUB"`
  - Telemetry: `path: "stub"`, `status: "STUB"`, `errorCode: "NOT_ALLOWLISTED"`

### Stage 3 — Allowlist enabled + allowAI true + rollout 0
Goal: First real “eligible” condition (all gates pass).

- Set:
  - `SLOTGEN_AI_KILL=false`
  - `FEATURE_SLOTGEN_AI=true`
  - Allowlist enabled and matches the job
  - Input job has `metadata.allowAI=true`
  - `SLOTGEN_AI_ROLLOUT_PERCENT=0`
  - `OPENAI_API_KEY` set (real) OR `OPENAI_BASE_URL` pointed to stub server (controlled)
- Expected:
  - Output: `status: "COMPLETED"` (real path) OR controlled “COMPLETED” via stubbed server
  - Telemetry: `path: "openai"`, `status: "COMPLETED"`, latency present

### Stage 4 — Rollout gating (optional, controlled exposure)
Goal: Gradual exposure even when allowlist matches.

- Set:
  - Same as Stage 3, but set `SLOTGEN_AI_ROLLOUT_PERCENT` to a small number (e.g., `1`, `5`, `10`)
- Expected:
  - Some jobIds yield `COMPLETED`, others yield `STUB`
  - When excluded:
    - Output: `status: "STUB"`
    - Telemetry errorCode: `ROLLOUT_EXCLUDED`

## Verification (required before proceeding)

- Confirm:
  - No markdown/commentary is emitted by the executor (JSON only).
  - Output validates against `slot-generation-result.v1.schema.json`.
  - Telemetry validates against `slot-generation-telemetry.v1.schema.json`.
  - The kill-switch can immediately force STUB again (Stage 0).

## Rollback (always available)

- Immediate rollback:
  - Set `SLOTGEN_AI_KILL=true` (dominates; forces STUB).
- If needed, also set:
  - `FEATURE_SLOTGEN_AI` to not `"true"`.

## Notes

- This checklist must only change via an explicit Phase 6 docs decision and a new lock tag.
