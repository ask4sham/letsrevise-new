# PR-PAST-PAPERS-API-1: GET /api/past-papers/mine + filtering + UI uses PastPaper records

**Merge-ready handoff.**

---

## A) Summary

- **Backend:** `GET /api/past-papers/mine` — auth required, returns only papers for the logged-in teacher (`ownerId`). Supports filters: `specKey`, `examBoard`, `level`, `year`, `series`, `tier`, `paperCode`, `q` (search title/paperCode/series). Pagination: `limit` (default 50, max 200), `cursor` (createdAt). Sorted newest-first.
- **Frontend:** New tab **“My papers”** on Past Papers page fetches from `/api/past-papers/mine` and displays PastPaper records with copyright-safe copy (“Teacher-uploaded”, “View uploaded PDF”, “No PDF attached”).
- **Consistency:** EditLessonPage past-paper file action switched from “Download” to “View uploaded PDF” using `viewTopicPastPaperFile`.

---

## B) Files changed

### Backend

| File | Change |
|------|--------|
| `backend/routes/pastPapers.js` | **New.** GET `/mine` with auth, filters, cursor pagination. |
| `backend/app.js` | Mount `app.use("/api/past-papers", require("./routes/pastPapers"))`. |
| `backend/tests/pastPapers.mine.integration.test.js` | **New.** Auth required; returns only my papers. |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/api/pastPapers.ts` | **New.** `PastPaper` type, `fetchMyPastPapers(params)`. |
| `frontend/src/pages/TeacherPastPapersBankPage.tsx` | Tab “My papers” (default), fetch from `fetchMyPastPapers`, table with filters (specKey, year, series, tier, q), “View uploaded PDF” / “No PDF attached”, “Teacher-uploaded”. |
| `frontend/src/pages/EditLessonPage.tsx` | Past paper file action: use `viewTopicPastPaperFile`, label “View uploaded PDF”, error “Failed to open PDF”. |

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
cd backend
npx jest tests/pastPapers.mine.integration.test.js --no-coverage
```

### Frontend

1. Open Past Papers page.
2. Confirm **“My papers”** tab is first and lists PastPaper records from `/api/past-papers/mine`.
3. Confirm filters (search, year, series, tier) and “View uploaded PDF” / “No PDF attached”.
4. Confirm disclaimer and “Teacher-uploaded” badge.
5. On Edit Lesson, confirm past paper file action says “View uploaded PDF” and opens in new tab.

---

## D) PR title + description (copy/paste)

**Title**

```
PR-PAST-PAPERS-API-1: Add /api/past-papers/mine + filtering + UI uses PastPaper records
```

**Description**

```
Adds an authenticated endpoint to fetch teacher-owned PastPaper records with filtering and cursor pagination. Updates Past Papers UI to use PastPaper model for listing (new "My papers" tab) while retaining copyright-safe copy ("teacher-uploaded", "view uploaded PDF") and existing upload rights guardrails. Includes integration tests using the existing JWT login pattern. Consistency sweep: EditLessonPage past paper file action uses "View uploaded PDF" and viewTopicPastPaperFile.
```
