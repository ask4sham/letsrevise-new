# Curriculum Engine — Phase Status

This directory contains the curriculum → lesson → generation pipeline.

## Locked phases

### Phase 2 — Lesson Structure
- Deterministic assembly
- Contract + schema enforced
- No runtime AI

### Phase 3 — Content Slots
- Slot mapping + deterministic filling
- Review flags (`requiresReview`)
- CI validation

### Phase 4A — Generation Interface
- Schema-defined job interface
- No execution logic

### Phase 4B — Generation Executor Boundary (LOCKED)
- `run-slot-generation.js` stub
- Input + output schema validation
- Deterministic jobId
- CI enforces valid/invalid cases
- Tagged: `phase-4b-locked`

### Phase 4C — AI Executor (PLANNED)
- See `PHASE_4C.md`
- Docs-only, no implementation yet
- Tagged: `phase-4c-planned`

## Rules
- No generation in APIs or frontend
- No schema bypasses
- All generation flows through Phase 4B boundary

