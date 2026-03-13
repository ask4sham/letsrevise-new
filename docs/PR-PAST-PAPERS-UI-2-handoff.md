# PR-PAST-PAPERS-UI-2: Filters + past paper detail + linked questions + topic summary

**Merge-ready handoff (lean: manual add only, no “attach from bank”).**

---

## A) Summary

- **Backend:** `GET /api/past-paper-questions/mine?pastPaperId=<id>` (teacher-owned questions for a paper), `POST /api/past-paper-questions/link` (link teacher-authored questions; ownership + taxonomy validation + namespaced topicKey + fingerprint dedupe).
- **Frontend:** Filters component with debounced search + year/series/tier + clear; past paper detail panel (drawer) on row click with “View uploaded PDF”, linked questions list (expand for mark scheme), topic summary (counts + taxonomy display names), and “Link questions” modal (manual add: topic + question + mark scheme).
- **Copy:** Stays copyright-safe (“Teacher-uploaded”, “View uploaded PDF”, no “download”).

---

## B) Files changed

### Backend

| File | Change |
|------|--------|
| `backend/routes/pastPaperQuestions.js` | **New.** GET `/mine`, POST `/link` (auth, ownership, taxonomy, dedupe). |
| `backend/app.js` | Mount `app.use("/api/past-paper-questions", require("./routes/pastPaperQuestions"))`. |
| `backend/tests/pastPaperQuestions.mine.integration.test.js` | **New.** Auth, pastPaperId required, GET returns items; POST link then GET returns linked question. |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/api/pastPaperQuestions.ts` | **New.** `fetchPastPaperQuestions`, `linkPastPaperQuestions`, types. |
| `frontend/src/components/pastPapers/PastPapersFilters.tsx` | **New.** Debounced `q`, year/series/tier, “Clear filters”. |
| `frontend/src/components/pastPapers/PastPaperDetailPanel.tsx` | **New.** Drawer: title/meta, “View uploaded PDF”, questions count/marks, list + topics summary, “Link questions”. |
| `frontend/src/components/pastPapers/PastPaperQuestionsList.tsx` | **New.** List with “View” to expand mark scheme; topic display name from taxonomy. |
| `frontend/src/components/pastPapers/PastPaperTopicsSummary.tsx` | **New.** Group by topicKey slug, display names from taxonomy, counts. |
| `frontend/src/components/pastPapers/LinkQuestionsModal.tsx` | **New.** Manual add: topic dropdown, question number, marks, question, mark scheme. |
| `frontend/src/pages/TeacherPastPapersBankPage.tsx` | PastPapersFilters in “My papers” tab; row click opens PastPaperDetailPanel; selectedPaper state. |

---

## C) Verify locally

### Backend

```bash
cd backend
npm run validate:taxonomies
npm test
```

Targeted:

```bash
npx jest tests/pastPaperQuestions.mine.integration.test.js --no-coverage
```

### Frontend (manual)

1. Filters change results; “Clear filters” resets; safe copy unchanged.
2. Click a past paper row → detail panel opens with “View uploaded PDF”, question count, list, topic summary.
3. “Link questions” → add question with topic (taxonomy dropdown) → question appears in list; topic summary updates.
4. Topics summary shows topic names (from taxonomy), not just slugs.

---

## D) PR title + description (copy/paste)

**Title**

```
PR-PAST-PAPERS-UI-2: Filters + past paper detail + linked questions + topic summary
```

**Description**

```
Adds teacher-owned Past Papers UI enhancements: filter/search controls (debounced), a detail panel on row click, linked PastPaperQuestion viewing with expandable mark scheme, topic breakdown using taxonomy display names, and a copyright-safe "link/add question" flow for teacher-authored content (manual add only; attach from bank deferred to UI-3). Maintains safe copy ("View uploaded PDF", "teacher-uploaded resource") and keeps all functionality scoped to the logged-in teacher's resources.
```
