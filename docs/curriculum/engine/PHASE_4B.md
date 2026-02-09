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
