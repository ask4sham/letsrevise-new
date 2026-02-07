// Curriculum — Intent (Phase E/F)

## Purpose
A **Curriculum** is a *packaged learning pathway* that groups and orders existing learning content (primarily Lessons) into a coherent sequence for a learner goal.

It is **not** a Lesson, **not** a free/published flag, and **not** a personalization engine.
It is a container + structure layer intended to be loadable and evolvable over time.

## What a Curriculum is (definition)
A Curriculum represents:
- A named learning pathway (e.g. "GCSE Maths Foundation: Algebra Basics")
- A description of the pathway and its goal
- Optional metadata to support future discovery and internal tools

In Phase E/F, Curriculum is intentionally inert:
- No delivery logic
- No AI generation
- No user-specific behaviour
- No new access control rules

## What a Curriculum is NOT
A Curriculum is not:
- A substitute for the Lesson model
- A curriculum ingestion system
- A recommendation engine
- A tutoring/personalization system
- A route/controller feature
- A visibility/publication system

## Relationship to existing models
- Lessons remain the source of content.
- Access control remains centralized in existing entitlement logic:
  - subscription validity
  - purchased lessons
  - free preview flag
- Curriculum does not override, bypass, or duplicate access rules.

## Ownership and creation (future-facing, not implemented)
Potential authorship (later phases only):
- Admin-created curricula (manual curation)
- System-created curricula (templates)
- AI-assisted curation (explicitly deferred)

In Phase E/F:
- No creator workflows exist
- No UI exposure exists
- No APIs exist

## Versioning and evolution (future-facing, not implemented)
Curriculum is expected to evolve in later phases to include:
- Ordered modules/units
- References to Lesson IDs
- Milestones/checkpoints
- Optional syllabus tags
- Optional difficulty/grade alignment

None of the above is implemented in Phase E/F.

## Guardrails (non-negotiable)
Until Phase F is explicitly activated:
- Do not add routes/controllers/jobs for Curriculum
- Do not add relationships or lesson linkage to Curriculum schema
- Do not add AI calls, queues, cron, or workers
- Do not expose Curriculum to the frontend
- Do not change entitlement logic to incorporate Curriculum

## Current implementation status
- Curriculum model exists and is registered at boot
- Schema is minimal and inert
- Guard comments are present to prevent drift
- No runtime behaviour depends on Curriculum

