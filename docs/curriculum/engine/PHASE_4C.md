# Phase 4C — Slot Generation (AI Executor)

This phase replaces the Phase 4B stub with a real generation executor.

## Inputs (unchanged)
- `slot-generation.v1.schema.json`
- Schema validation is mandatory
- Jobs are immutable once accepted

## Outputs (unchanged)
- Must validate against `slot-generation-result.v1.schema.json`
- Deterministic `jobId`
- Stored results only (generate-once, serve-many)

## Executor responsibilities
- Call model(s) with strict prompts
- Enforce allowed block / content types
- No markdown, no commentary, JSON only
- Attach safety metadata (review required, flags)

## Safety + cost controls
- Per-job token limits
- Per-run budget cap
- Caching by job hash
- Retry with backoff (bounded)

## Human review
- All outputs default to `requiresReview: true`
- Publish only after approval
- Immutable once published

## Explicit non-goals
❌ Runtime generation in APIs  
❌ Client-side generation  
❌ Bypassing schemas or contracts  

Phase 4C may ONLY extend Phase 4B — never replace it.

