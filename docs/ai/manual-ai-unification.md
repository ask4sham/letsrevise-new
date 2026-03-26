# STEP 16 — Manual + AI Unification

Both manual lesson creation (CreateLessonPage) and AI generation (generate-and-save) use the same schema and pass the same validation.

## Shared Schema

**Block structure** (from `backend/models/Lesson.js` LessonPageBlockSchema):

| Field | Type | Notes |
|-------|------|-------|
| type | string | `text`, `keyIdea`, `examTip`, `commonMistake`, `stretch`, `checkpoint`, `pageQuiz`, `diagram` |
| content | string | Markdown for text/keyIdea/examTip/commonMistake/stretch; "image here" fallback for diagram |
| title | string | Optional; e.g. "What to Notice" |
| role | string | Contract role: hook, coreRule, commonMistake, patternRecognition, workedExample, synthesis, finalMemoryRule, whatToNotice, concept, quickCheck |
| prompt | string | Checkpoint: question text |
| options | string[] | Checkpoint MCQ options |
| correctAnswer | string | Checkpoint correct answer |
| explanation | string | Checkpoint model answer |
| ... | | diagram: visualId, caption, mode, annotations, steps |

**Page structure**: `pages[]` with `pageId`, `title`, `order`, `blocks[]`, `checkpoint?` (legacy).

## Shared Validation

`validateLessonStructure` (backend: `lessonDraftValidation.js`, frontend: `utils/validateLessonStructure.ts`) checks:

1. At least 10 blocks
2. At least 2 diagrams
3. Required roles: hook, coreRule, commonMistake, patternRecognition, workedExample, synthesis, finalMemoryRule
4. At least one "What to Notice" block (role whatToNotice)
5. Worked example: role workedExample with substantial content (>30 chars)
6. Each checkpoint: real exam-style question (not placeholder), correct answer

## Where Validation Runs

| Path | Location | Action |
|------|----------|--------|
| Manual create | POST /api/lessons | Returns 400 if structureIssues.length > 0 |
| Manual publish | EditLessonPage computeLocalPublishIssues | Blocks publish; shows gate modal |
| AI generate-and-save | ai.js | Throws before save if invalid |
| AI improve-lesson | ai.js | Throws before save if invalid |

## Sanitization

- **Manual**: `sanitisePageInput` in `backend/routes/lessons.js` — normalises blocks, adds role/title, diagram content fallback.
- **AI**: `sanitizeDraft` in `backend/routes/ai.js` — same block shape, diagram content "image here".

Both produce blocks compatible with the Lesson model.
