# Cursor-ready PR prompt: Import → Browse → Edit smoke coverage

**Paste this into Cursor or use as the PR description for the next robustness move.**

---

## PR: Platform robustness — Import then browse/edit smoke (E2E-style integration)

### Goal

Add a single integration test that proves the full pipeline: **CSV preview → bulk import (drafts) → list in Question Browser → edit one question → verify saved.** This catches bugs where import writes data that the UI or PATCH API can’t render or update correctly.

### What to implement

**New file: `backend/tests/topicQuizQuestions.importBrowseEdit.integration.test.js`**

One describe block, one (or two) test(s) that:

1. **Setup:** Create a teacher user, log in, get `Authorization: Bearer <token>`.
2. **CSV preview:**  
   `POST /api/topic-quiz-questions/bulk/preview`  
   - Body: `{ topicKey, specKey, format: "csv", text: "<csv with header and 1–2 valid MCQ rows>" }`  
   - Assert: `res.status === 200`, `res.body.ok === true`, `res.body.summary.validCount >= 1`, and `res.body.previewItems` (or equivalent) has at least one item with `questionText`, `choices`, `correctIndex`.
3. **Import drafts:**  
   `POST /api/topic-quiz-questions/bulk`  
   - Body: `{ topicKey, specKey, items: [ ... ] }` where `items` are the same shape as the valid preview items (or use the preview response’s valid items if the API returns them in a commit-ready shape). Use `dedupeMode: "skip"` if needed.  
   - Assert: `res.status === 200`, `res.body.ok === true`, `res.body.createdIds` is an array with at least one id.
4. **Browse (list):**  
   `GET /api/topic-quiz-questions?topicKey=<same>&status=draft`  
   - Same auth.  
   - Assert: `res.status === 200`, and at least one item in `res.body.items` has `_id` equal to one of `createdIds`, with matching `questionText` (or key fields) from the imported item.
5. **Edit:**  
   `PATCH /api/topic-quiz-questions/:id`  
   - Use one of the `createdIds`. Body e.g. `{ questionText: "Edited after import" }` or `{ choices: ["A", "B", "C"], correctChoice: "B" }`.  
   - Assert: `res.status === 200`, `res.body.item` present, and `res.body.item.questionText === "Edited after import"` (or that the patched field is persisted).
6. **Verify saved:**  
   Either use the PATCH response’s `res.body.item` or do a second `GET /api/topic-quiz-questions?topicKey=...&status=draft` and find the same id; assert the edited value is present.

**Cleanup:** In `afterAll`, delete the created `TopicQuizQuestion` documents for the test teacher (e.g. by `ownerId`) and the test user.

### Files to touch

| File | Action |
|------|--------|
| `backend/tests/topicQuizQuestions.importBrowseEdit.integration.test.js` | **Create** – single describe, 1–2 tests as above |
| (optional) `backend/package.json` or test config | No change needed if `jest` already picks up `tests/**/*.integration.test.js` |

### API reference (existing behaviour)

- **POST /api/topic-quiz-questions/bulk/preview**  
  Body: `{ topicKey, specKey?, format: "json" | "csv", text }`.  
  Response: `{ ok, summary: { totalParsed, validCount, invalidCount, duplicatesInPayload }, previewItems?, invalid? }`.
- **POST /api/topic-quiz-questions/bulk**  
  Body: `{ topicKey, specKey?, items: [...], dedupeMode?: "skip"|"error"|"allow", kind?: "quiz"|"assessment" }`.  
  Response: `{ ok, createdCount, createdIds, skipped: { duplicatesInPayload, duplicatesInDb, invalid } }`.
- **GET /api/topic-quiz-questions**  
  Query: `topicKey` (required), `status?: "draft"|"published"|"all"`, `mineOnly?: 1`.  
  Response: `{ items: TopicQuizQuestion[] }`.
- **PATCH /api/topic-quiz-questions/:id**  
  Body: partial (e.g. `questionText`, `choices`, `correctChoice`, `acceptableAnswers`, etc.).  
  Response: `{ item: TopicQuizQuestion }`.

### Acceptance criteria

- [ ] New test file exists and is named as above.
- [ ] Test runs with:  
  `npx jest tests/topicQuizQuestions.importBrowseEdit.integration.test.js --no-coverage`
- [ ] Full suite still passes:  
  `npm test` (e.g. 104/104 suites, 613/613 tests or current count +1).
- [ ] Test does not depend on real CSV file paths; CSV is inline in the test (or a minimal string).
- [ ] Test cleans up created questions and user in `afterAll`.

### Suggested CSV for the test (minimal)

```csv
questionText,choiceA,choiceB,choiceC,choiceD,correct
"Import smoke question?",Yes,No,Maybe,N/A,A
```

Use a `topicKey` that matches your spec (e.g. `aqa-gcse-biology:cell-structure` or a topic used in other quiz tests). Use the same `topicKey` for preview, bulk, and GET.

### Result (for PR description)

- End-to-end “import then browse/edit” is covered by an integration test.
- Regressions where import succeeds but list or PATCH fails (or returns wrong shape) will be caught.
- No UI or Playwright required; all steps are HTTP against the existing backend routes.

### How to run after implementation

```bash
cd backend
npm test
npx jest tests/topicQuizQuestions.importBrowseEdit.integration.test.js --no-coverage
```

---

*Next robustness move after Option A (CSV pipeline wired + tested).*
