# Phase 4F — Beta Launch Checklist (Slot Generation)

## Pre-flight (must already be true)

- CI green on `main`
- Tags exist:
  - `phase-4c-openai-guarded`
  - `phase-4d-rollout-contract-locked`
  - `phase-4e-beta-ready`

## Hard safety gates (must remain ON throughout Beta)

- `SLOTGEN_AI_KILL=true` default in prod
- “AI only if allowAI + allowlist + rollout” invariant
- Result schema validation enforced
- Telemetry emitted on every run

## Allowed rollout knobs (and the only order permitted)

1. Choose allowlist rule (subject/board/level/kind) for Beta cohort
2. Set `SLOTGEN_AI_ROLLOUT_PERCENT` from `0` -> `1` -> `5` -> `10` -> `25` -> `50`
3. Only then consider widening allowlist scope

## Rollback plan (single command-level actions)

- Immediate: set `SLOTGEN_AI_KILL=true`
- Follow-up: set rollout percent to `0`, disable allowlist

## Definition of “Beta running”

- At least N real jobs executed via OpenAI path
- Telemetry shows stable success rate + latency bounds
- Zero schema violations
