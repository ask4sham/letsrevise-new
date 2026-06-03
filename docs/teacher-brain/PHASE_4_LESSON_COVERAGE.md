# Teacher Brain Phase 4 — Lesson Coverage Intelligence

**Status:** Implemented (June 2026)

## Goal

Balance assessment across a lesson so no concept dominates unless it is the **central learning objective**.

## Tracked per lesson

| Dimension | Source |
| --- | --- |
| Concepts taught | Teach blocks (`text`, `keyidea`, concept roles, etc.) |
| Concepts tested | Checkpoints, interactions, drag-drop, quiz items |
| Misconceptions addressed | `commonmistake` blocks |
| Exam skills assessed | `examtip`, exam practice, mark-bearing questions |

## Coverage map

`runTeacherBrain()` always returns `coverageMap` with:

- Per-concept counts and cognitive-skill balance (Recall, Explain, Apply, Analyse, Evaluate)
- `centralConceptId` (first `critical` concept in the topic profile)
- `dominanceWarnings` when a non-central concept is over-tested

Pass existing lesson content via `pages` and `quiz` on `runTeacherBrain` input for live-lesson scanning.

## Pre-generation gate

`checkCoverageBeforeGeneration(coverageMap, { generationKind, suggestedConceptId })`:

1. Checks coverage.
2. Avoids non-central concepts tested ≥ 2 times.
3. Prefers lowest-covered concepts.
4. Rotates least-used cognitive skills.

### Wired generation entry points (Phase 4 enforcement)

| Path | `generationKind` | Diagnostics |
| --- | --- | --- |
| `generateLessonAssets` (flashcards / quiz / exam) | `retrieval` / `quiz` / `exam` | `metadata.coverage` on bank drafts |
| `runCheckpointGenerationJob` | `checkpoint` | `item.coverage`, `job.resultPayload.coverageDiagnostics` |
| `runPracticeSetGeneration` | mixed | `coverageDiagnostics` on API response |
| `POST /api/ai/explain-chunk` (optional `lessonId`) | client `generationKind` | response `coverage` + `[CoverageGate]` logs |
| `POST /api/ai/generate-practice-quiz` | `practice` | `questions[].coverage` |
| Teacher Brain brief injection | `hotspot` / `activity` | brief note (Phase 3 preserved) |

Enable logs: `TEACHER_BRAIN_COVERAGE_LOG=1`

### One-shot lesson JSON (wired)

- `mergeOneShotCoveragePlanIntoInstructions` on `POST /api/ai/generate-lesson` and `generate-and-save`
- V4 appendix via `buildTeacherBrainPromptAppendixFromContext` (includes `--- ONE-SHOT LESSON COVERAGE PLAN`)
- Pass `seedPages` / `pages` on regenerate to honour existing drag-drop, step-by-step, and checkpoints

### Teacher Coverage Review panel (Edit Lesson)

- `GET /api/lessons/:id/coverage-review` — live diagnostics (no DB writes)
- `TeacherCoverageReviewPanel` in Edit Lesson sidebar (below Readiness)
- Includes topic-bank AI drafts (`metadata.source: ai_lesson_assets`, `metadata.lessonId`)

### Not yet wired

- Revision slot engine (`generateRevisionForLesson`) — separate executor

## Key module

`lib/teacherBrain/lessonCoverageIntelligence.js`

## Tests

`tests/teacherBrain.lessonCoverage.test.js`
