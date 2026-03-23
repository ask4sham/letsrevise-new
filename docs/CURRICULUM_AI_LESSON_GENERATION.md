# Curriculum-Controlled AI Lesson Generation

## Overview

The platform (not the AI) is the source of truth for exam-board-aligned lesson generation. This document describes the current implementation, data sources, and rollout order.

---

## Exact Files Changed

| File | Change |
|------|--------|
| `backend/config/aiLessonBoardConfig.js` | **NEW** — Board-specific prompt hints (AQA, Edexcel, OCR, WJEC) |
| `backend/services/lessonDraftValidation.js` | **NEW** — Validation layer for spec coverage, keywords, misconceptions, exam questions |
| `backend/prompts/AI_LESSON_PROMPT.md` | Extended with key words guidance, diagram guidance |
| `backend/routes/ai.js` | Extended `buildUserPromptFromMd` with requiredKeywords, requiredMisconceptions, board hints; added validation call; stores `generationValidation` in lesson metadata; returns validation in response |
| `docs/CURRICULUM_AI_LESSON_GENERATION.md` | **NEW** — This document |

---

## Current Data Sources for Curriculum Control

| Source | Location | Used for |
|--------|----------|----------|
| **Spec points (JSON)** | `backend/config/spec_points/*.json` (e.g. `aqa_gcse_biology.json`) | Spec statements per topic → injected into prompt; validation |
| **SpecStatement (Mongo)** | `backend/models/SpecStatement.js` | Admin CRUD; ingest; not yet wired to AI prompts (can be added) |
| **PastPaperQuestion (Mongo)** | `backend/middleware/...`, `syllabusAlignment.getPastPaperSnippetsForTopic` | Past paper snippets for prompt context |
| **Topic taxonomy** | `backend/config/*_topics.json`, `backend/utils/topicTaxonomy.js` | Topic resolution, scope, drift validation |
| **Board config** | `backend/config/aiLessonBoardConfig.js` | Question phrasing, exam tips, answer style per board |
| **Request body** | `POST /api/ai/generate-and-save` | Optional `requiredKeywords[]`, `requiredMisconceptions[]` (future: UI selector) |

---

## What Is Implemented vs Scaffolded

### Implemented

1. **Curriculum-controlled input**
   - `subject`, `level`, `board`, `tier`, `topic`, `topicKey` from existing modal
   - `specPoints` from `getSpecPointsForTopic(specKey, topicKey)` (JSON files)
   - `pastPaperSnippets` from `getPastPaperSnippetsForTopic`
   - `requiredKeywords[]`, `requiredMisconceptions[]` from request body (optional)
   - Board-specific hints (AQA, Edexcel, OCR, WJEC) injected into prompt

2. **Structured AI output**
   - Fits existing lesson builder: `text`, `keyIdea`, `examTip`, `commonMistake`, `stretch`, `checkpoint`
   - Key words: prompt asks AI to include in text block when keywords provided
   - Diagram guidance: prompt instructs to add text block describing diagram when helpful

3. **Validation layer**
   - `validateLessonDraftAgainstCurriculum(draft, opts)` checks:
     - All selected spec statements covered (substring in draft text)
     - Required keywords present
     - Required misconceptions present
     - At least one exam-style question (checkpoint block)
   - Result stored in `lesson.metadata.generationValidation`
   - Returned in API response; warning shown if invalid

4. **Board-specific generation**
   - `aiLessonBoardConfig.js` defines hints per AQA, Edexcel, OCR, WJEC
   - `buildBoardPromptFragment(board)` injects question phrasing, exam tip style, answer format

### Scaffolded (Future)

1. **Selected spec statements UI** — Backend accepts `requiredKeywords`, `requiredMisconceptions`; no UI yet. Could add a selector in the AI modal that fetches spec statements by topic and lets the user tick which to require.
2. **SpecStatement integration** — `GET /api/spec-statements/:specKey` exists; could replace or supplement JSON spec points when richer data is needed.
3. **Keywords/misconceptions from curriculum** — No dedicated curriculum table for keywords or misconceptions yet; they are passed via request. Could derive from taxonomy or a future curriculum model.

---

## Smallest Safe Rollout Order

1. **Phase 1 (done)** — Board config, validation service, prompt extension, wiring into generate-and-save. No breaking changes; existing modal unchanged.
2. **Phase 2** — Optional UI: "Advanced" section in AI modal to add required keywords/misconceptions (text inputs or future selector).
3. **Phase 3** — SpecStatement integration: when `selectedSpecStatementIds` provided, fetch from Mongo and use instead of or in addition to JSON spec points.
4. **Phase 4** — Curriculum keywords/misconceptions: add a curriculum data source (e.g. per-topic keywords in taxonomy) and auto-populate when topic selected.

---

## API Changes

### POST /api/ai/generate-and-save

**New optional request body fields:**
- `requiredKeywords`: `string[]` — Keywords that must appear in generated content
- `requiredMisconceptions`: `string[]` — Misconception phrases that must appear (e.g. in commonMistake blocks)

**New response fields:**
- `generationValidation`: `{ valid, missingSpecPoints, missingKeywords, missingMisconceptions, hasExamQuestions, summary }`
- `warning`: Appended with curriculum validation summary if invalid

---

## Constraints Respected

- Did not break existing AI modal
- Did not replace current lesson creation flow
- Added to the system; no redesign
- Minimal and safe implementation
