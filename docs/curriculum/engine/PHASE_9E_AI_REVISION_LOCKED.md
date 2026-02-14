# Phase 9E — AI revision pipeline locked

AI-generated revision is stored as a **draft only**; draft visibility is owner/admin. Teacher reviews/edits, then applies to the lesson; lesson publish uses the existing Phase 9D state machine.

**Tag:** `phase-9e-ai-revision-locked`

---

## Pipeline

1. **Generate** — POST generate-revision writes to **LessonRevisionDraft** (upsert by lessonId). No write to lesson. Draft-only visibility.
2. **Review/edit** — GET revision-draft (owner/admin), PUT revision-draft (owner/admin) to edit flashcards/quiz.
3. **Apply** — POST revision-draft/apply copies draft to lesson (lesson.flashcards, lesson.quiz), marks draft as applied. **Allowed only when lesson.status is draft or in_review.** If lesson is **published** → **409 EDIT_PUBLISHED** (unpublish first; keeps published content changes in the review loop).
4. **Publish** — Use existing Phase 9D: submit-review → approve. Students see content only when lesson is published.

---

## Kill-switch

- **DISABLE_AI_REVISION_GENERATION=1** — POST /api/lessons/:id/generate-revision returns **503** with `code: "REVISION_GENERATION_DISABLED"`. No draft created.

---

## Model

- **LessonRevisionDraft**: `lessonId` (unique), `generatedBy`, `flashcards`, `quiz`, `status` (draft | applied). One draft per lesson.

---

## Routes

| Method | Path | Auth | Who | Behaviour |
|--------|------|------|-----|-----------|
| POST | /api/lessons/:id/generate-revision | ✓ | owner/admin | Generate into draft (upsert). 503 if kill-switch. |
| GET | /api/lessons/:id/revision-draft | ✓ | owner/admin | Return draft. 404 if none. |
| PUT | /api/lessons/:id/revision-draft | ✓ | owner/admin | Update draft (flashcards/quiz). 409 if already applied. |
| POST | /api/lessons/:id/revision-draft/apply | ✓ | owner/admin | Copy draft to lesson, set draft status applied. 409 if already applied. |

---

## Service

- **backend/services/generateRevision.js** — `generateRevisionForLesson({ lesson })` returns `{ flashcards, quiz }`. Respects kill-switch inside service. Replace with real OpenAI when ready.

---

## Tests and CI

- **backend/tests/revisionDraft.integration.test.js**: generate creates draft, GET (owner), student 403, apply copies to lesson, apply again 409; apply to published lesson → 409 EDIT_PUBLISHED; kill-switch 503.
- **npm run test:backend** includes this suite.

---

## Tagging (one-time)

After CI is green, run each command on its own line (copy/paste-safe; do not paste as one line):

```
git tag -a phase-9e-ai-revision-locked -m "Phase 9E AI revision pipeline locked: draft-only visibility, generate/GET/PUT/apply, kill-switch, tests"

git push origin phase-9e-ai-revision-locked
```
