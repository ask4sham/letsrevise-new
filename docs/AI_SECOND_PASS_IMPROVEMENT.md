# AI Second-Pass Lesson Improvement

## Overview

When an AI-generated lesson draft is weak or incomplete, the system automatically sends it back to the model with validation feedback and requests an improved version before saving. This happens transparently; no UI or workflow changes for teachers.

---

## Flow

1. **First pass** — Generate lesson draft as normal (same as before).
2. **Validate** — Run `validateLessonDraftAgainstCurriculum` (spec coverage, subheadings, misconceptions, key words, exam tips, exam-style Q&A).
3. **Threshold check** — If `shouldTriggerSecondPass(validation)` is true, run second pass.
4. **Second pass** — Send draft + validation feedback to the model; request improvements. Parse and sanitize response.
5. **Fallback** — On any error (parse, API, etc.), keep original draft and log warning.
6. **Save** — Proceed with hero, pages, lesson creation (unchanged).

---

## Quality Threshold (Triggers Rewrite)

Rewrite is triggered when **any** of the following:

- **Hard validation failure** (`valid === false`): missing spec coverage, required keywords, required misconceptions, or no exam questions
- **Subheadings < 3** — Content lacks structured teaching sections
- **Misconceptions < 3** — Need at least 3 common misconception blocks
- **Missing exam questions** — No checkpoint or exam-style content
- **Missing key words** — No key words block detected
- **Validation warnings** — Fewer than 2 exam tips, or no exam-style Q&A with answers

---

## Second-Pass Improvement Prompt

The model receives:

- Current draft (as JSON, truncated to 60k chars if needed)
- Validation feedback (specific failures and quality issues)
- Context: topic, subject, level, board, tier, spec points

Instructions to the model:

- Return valid JSON matching the lesson schema
- Deepen shallow sections
- Fill missing subtopics
- Improve misconceptions
- Improve exam questions and answers
- Improve structure and teaching flow
- Keep same block types (text, keyIdea, examTip, commonMistake, stretch, checkpoint)

---

## Files Changed

| File | Change |
|------|--------|
| `backend/services/lessonDraftValidation.js` | Added `shouldTriggerSecondPass(validation)` |
| `backend/routes/ai.js` | Added `improveDraftWithSecondPass()`; wired into generate-and-save with try/catch fallback |
| `docs/AI_SECOND_PASS_IMPROVEMENT.md` | **NEW** — This document |

---

## Constraints Respected

- No UI changes
- No workflow changes for teachers
- Additive backend only
- Safe fallback: on second-pass failure, original draft is saved
- Existing generation flow preserved; second pass is an optional improvement step
