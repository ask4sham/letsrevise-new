# Phase 4B — Slot Generation Executor Boundary

This phase defines the **execution boundary** between:
- deterministic curriculum artifacts
- generated lesson content (AI or otherwise)

## What exists now
- `scripts/run-slot-generation.js`
- Schema-validated input (`slot-generation.v1.schema.json`)
- Deterministic stub output (`status: "STUB"`)
- CI enforces:
  - invalid jobs are rejected
  - valid jobs are accepted

## What is NOT allowed
❌ Generating content inside:
- API routes
- frontend code
- curriculum assembly scripts

❌ Skipping schema validation

## Future phases
**Phase 4C** will:
- replace stub generation with real model calls
- add caching + cost controls
- add safety filters + audit logs
- persist generated results

Until then, **this stub is the only legal generation entrypoint**.

## Output contract (locked)

All slot-generation executors (including the stub) MUST emit results that
validate against:

- `slot-generation-result.v1.schema.json`

CI enforces that:
- invalid inputs are rejected
- valid inputs produce schema-valid results
- `jobId` is deterministic (derived from the job spec)

No executor may emit ad-hoc or undocumented output.
