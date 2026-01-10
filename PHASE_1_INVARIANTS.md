# Phase 1 – Parent Progress Invariants (LOCKED)

These rules define what Phase 1 of the Parent Progress feature is allowed to do.
They are intentionally conservative to protect parent trust.

## What Parents May See
- High-level progress signals only
- Subject-level trends derived from quiz attempts
- Human-safe language (e.g. Strength, Needs Attention, On Track)

## What Parents Must NEVER See
- Raw quiz scores or marks
- Percentages representing real performance
- Question-level or attempt-level detail
- Timings, speed, or accuracy metrics
- Curriculum-wide subject coverage

## Data Rules
- Subjects appear ONLY if the child has attempted quizzes in that subject
- All progress is inferred from quiz attempts, not curriculum expectations
- Empty or unattempted subjects must never be exposed

## Semantics (Strict)
Allowed values only:

status:
- strength
- needs_attention
- neutral

trend:
- improving
- stable
- declining

No other values are permitted in Phase 1 responses.

## Phase Boundary
- Phase 1 is trend-based only
- Any new metrics (time-on-task, streaks, activity feeds) belong to Phase 2+
- Phase 1 logic must not be extended without reopening this document

## Lock Statement
Phase 1 Parent Progress is considered **LOCKED** once this document exists
and corresponding guardrails are in place.

Do not violate these rules accidentally or incrementally.
