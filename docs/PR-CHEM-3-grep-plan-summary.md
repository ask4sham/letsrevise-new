# PR-CHEM-3: TopicKey namespacing — grep plan summary

**Objective:** Store `topicKey` in namespaced form `specKey:topicKey` (e.g. `aqa-gcse-chemistry:rate-of-reaction`) so Biology and Chemistry don’t collide, while staying **backward compatible** with legacy (non-namespaced) keys.

**Conventions:**
- **Namespaced stored key:** `${specKey}:${topicKey}`
- **Legacy key:** no `:`, treated as Biology for fallback reads (`DEFAULT_SPEC_LEGACY = "aqa-gcse-biology"`)

---

## Part 0 — Helpers (done)

- **`backend/utils/topicKey.js`** — `buildTopicKey`, `parseTopicKey`, `isNamespacedTopicKey`, `normalizeToStoredKey`, `queryCandidates`, `DEFAULT_SPEC_LEGACY`
- **`backend/utils/topicTaxonomy.js`** — `findTopicBySpecAndKey`, `isValidTopicForSpec` (use parsed topic; support Biology + Chemistry)

---

## Part 1 — Backend: writes (done)

| Location | Change |
|----------|--------|
| `backend/routes/topicFlashcards.js` | Create/bulk: `resolveStoredTopicKey(specKey, topicKey)` → store namespaced |
| `backend/routes/topicQuizQuestions.js` | Create/bulk: same; bulk preview duplicate check uses `topicKey: { $in: queryKeys }` |
| `backend/routes/topicPastPapers.js` | Create/bulk/upload: same; upload reads `topicKey` + `specKey` from body |
| `backend/routes/examQuestions.js` | POST/PUT: resolve and store namespaced |
| `backend/routes/flashcardBank.js` | Import: optional `specKey`, store `buildTopicKey(specKey, validKey)`; find existing by `$in: candidates` then update or create |
| `backend/routes/lessons.js` | Lesson create/update that persist `topicKey` — pass-through only; no change to stored lesson shape |

---

## Part 1 — Backend: reads / queries (done)

| Location | Change |
|----------|--------|
| `backend/routes/topicFlashcards.js` | List: `topicKey: { $in: resolveTopicKeyForQuery(specKey, topicKey) }` |
| `backend/routes/topicQuizQuestions.js` | List + bulk preview: `topicKey: { $in: candidates }` |
| `backend/routes/topicPastPapers.js` | List + bulk/upload dedupe: `topicKey: { $in: queryKeys }` |
| `backend/routes/examQuestions.js` | GET list: `topicKey: { $in: candidates }` |
| `backend/routes/lessons.js` | GET `/practice`, GET `/practice-questions`: `parseTopicKey` + `queryCandidates`, `ExamQuestion.find({ topicKey: { $in: topicQueryCandidates } })` |
| `backend/utils/attachExamQuestionsByTopic.js` | `queryCandidates(specKey, topicOnly)`; `ExamQuestion.find({ topicKey: { $in: queryCands } })`; validation via `findTopicBySpecAndKey` + `findTopicByKey` |
| `backend/routes/flashcardBank.js` | GET + copy-to-lesson: `FlashcardBank.findOne({ topicKey: { $in: candidates } })` |
| `backend/routes/ai.js` | Lesson factory seed from FlashcardBank: `FlashcardBank.findOne({ ownerId, topicKey: { $in: candidates } })` |
| `backend/services/autoGenerateLessonFromBanks.js` | Already uses `queryCandidates` + `$in` |
| `backend/services/generateLessonQuizFromTopic.js` | Already uses `queryCandidates` + `$in` |
| `backend/services/generateLessonAssessmentFromTopic.js` | Already uses `queryCandidates` + `$in` |
| `backend/services/generateLessonPastPapersFromTopic.js` | Already uses `queryCandidates` + `$in` |
| `backend/utils/seedLessonFlashcardsFromTopic.js` | Already uses `queryCandidates` + `$in` |

---

## Part 2 — Frontend (done)

| Location | Change |
|----------|--------|
| `frontend/src/api/topicFlashcards.ts` | ListParams + create + preview + bulk: optional `specKey` |
| `frontend/src/api/topicQuizQuestions.ts` | List opts + preview + bulk: optional `specKey` |
| `frontend/src/api/topicPastPapers.ts` | ListParams + preview + bulk + upload: optional `specKey` |
| `frontend/src/pages/TeacherFlashcardBankPage.tsx` | Pass `specKey` in list, create, preview, bulk |
| `frontend/src/pages/TeacherQuizBankPage.tsx` | Pass `specKey` in list, preview, bulk |
| `frontend/src/pages/TeacherPastPapersBankPage.tsx` | Pass `specKey` in list, preview, bulk, upload |
| `frontend/src/pages/TeacherExamQuestionBankPage.tsx` | Pass `specKey` in fetch params and create/update payload |

---

## Part 3 — Models / indexes

- **Models:** `TopicFlashcard`, `TopicQuizQuestion`, `TopicPastPaper`, `ExamQuestion`, `FlashcardBank`, `Worksheet`, `Lesson` — all have `topicKey` (string). No schema change; namespaced value is still a string.
- **Indexes:** Unique indexes on `(ownerId, topicKey, fingerprint)` etc. remain valid; namespacing increases uniqueness (e.g. `aqa-gcse-biology:cell-structure` vs `aqa-gcse-chemistry:rate-of-reaction`).

---

## Part 4 — Tests (done)

- **`backend/tests/topicKey.namespacing.integration.test.js`** — Chemistry/Biology namespaced create; list returns both; invalid topicKey → 400
- **`backend/tests/topicFlashcards.integration.test.js`** — List assertion accepts legacy or namespaced `topicKey`
- **Optional:** Other tests that send `topicKey` (e.g. examQuestionsTopicKey, lessonPractice, makeClassroomReady) — expect stored/returned key may be namespaced or legacy; no change unless assertion breaks

---

## Part 5 — Migration and runbook

- **`backend/scripts/migrate-topicKeys-to-namespaced.js`** — Dry run by default; `--apply` prefixes legacy `topicKey` (no `:`) with `aqa-gcse-biology:` for TopicFlashcard, TopicQuizQuestion, TopicPastPaper, ExamQuestion
- **`docs/runbook.md`** — Section added for when and how to run the migration

---

## Grep reference (impacted files)

**Backend — topicKey written/queried:**  
`topicKey.js`, `topicTaxonomy.js`, `topicFlashcards.js`, `topicQuizQuestions.js`, `topicPastPapers.js`, `examQuestions.js`, `lessons.js`, `flashcardBank.js`, `attachExamQuestionsByTopic.js`, `autoGenerateLessonFromBanks.js`, `generateLesson*FromTopic.js`, `seedLessonFlashcardsFromTopic.js`, `ai.js`, `teacher.js`, `student.js`, `worksheets.js`, `reports.js`, `diagramSuggestions.js`, `verifyIndexes.js`, models (TopicFlashcard, TopicQuizQuestion, TopicPastPaper, ExamQuestion, FlashcardBank, Worksheet).

**Frontend — topicKey/specKey in API or UI:**  
`topicFlashcards.ts`, `topicQuizQuestions.ts`, `topicPastPapers.ts`, `TeacherFlashcardBankPage.tsx`, `TeacherQuizBankPage.tsx`, `TeacherPastPapersBankPage.tsx`, `TeacherExamQuestionBankPage.tsx`, `EditLessonPage.tsx`, `FlashcardsEditor.tsx`, `LessonViewPage.tsx`, `TeacherWorksheetBuilderPage.tsx`, and related API types.

**Not changed (read-only or out of scope):**  
`reports.js` (topicKey in aggregation/display only), `teacher.js` (topicKey in response shape), `student.js` (topicKey from taxonomy/lesson), `worksheets.js` (topicKey as optional filter), `Lesson.model` (topicKey optional) — no namespacing requirement for lesson’s own topicKey in this PR.

---

## Safe order applied

1. Helpers (`topicKey.js`, taxonomy)
2. Bank write routes (topicFlashcards, topicQuizQuestions, topicPastPapers, examQuestions, flashcardBank import)
3. Bank list + practice + attach + generators (query with `$in` candidates)
4. Frontend API clients + bank pages (send `specKey`)
5. Tests + migration script + runbook
