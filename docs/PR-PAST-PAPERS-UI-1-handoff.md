# PR-PAST-PAPERS-UI-1: Copyright-safe past papers UI + upload rights confirmation

**Merge-ready handoff — copy/paste as needed.**

---

## A) Summary

Implements a copyright-safe Past Papers UI and enforces upload rights confirmation end-to-end.

- UI copy avoids “download past papers” and frames everything as **teacher-uploaded resources**
- **Mandatory rights confirmation** checkbox before upload
- **Backend hard guardrail:** `confirmCopyright` required (rejects with 400 otherwise)
- UI uses **“View uploaded PDF”** (open in new tab), not “download”
- **Teacher-uploaded** badge + clear disclaimer: platform does not distribute official exam materials
- Adds test coverage for `confirmCopyright` enforcement

---

## B) Files changed (checklist)

### Backend

| File | Change |
|------|--------|
| `backend/routes/adminMedia.js` | ✅ Add `confirmCopyright` guardrail (400 if missing/false) |
| `backend/routes/topicPastPapers.js` | ✅ Same guardrail on topic past papers upload path |
| `backend/tests/media.upload.integration.test.js` | ✅ New test: missing `confirmCopyright` → 400; existing tests send `confirmCopyright` |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/components/pastPapers/CopyrightNotice.tsx` | ✅ Disclaimer component |
| `frontend/src/components/pastPapers/ConfirmUploadRightsModal.tsx` | ✅ Mandatory checkbox modal |
| `frontend/src/components/pastPapers/PastPaperUploadButton.tsx` | ✅ Upload UX wrapper |
| `frontend/src/api/media.ts` | ✅ `uploadPdfWithConfirmation` sends `confirmCopyright` |
| `frontend/src/api/topicPastPapers.ts` | ✅ Upload includes `confirmCopyright`; view uses “View uploaded PDF” |
| `frontend/src/pages/TeacherPastPapersBankPage.tsx` | ✅ Safe copy + private/teacher-uploaded framing + view flow |

---

## C) Acceptance criteria

- [ ] Upload is blocked unless user confirms rights (UI checkbox)
- [ ] Server rejects upload if `confirmCopyright` missing/false (400)
- [ ] Page language is copyright-safe:
  - “Past Papers & Exam Resources”
  - “Your uploaded resources”
  - “Teacher-uploaded”
  - “View uploaded PDF”
- [ ] Explicit disclaimer that LetsRevise doesn’t distribute official materials
- [ ] No “download past paper” wording anywhere in UI for this feature

---

## D) Verify locally

### Backend tests (full)

```bash
cd backend
npm test
```

### Targeted test

```bash
cd backend
npx jest tests/media.upload.integration.test.js --no-coverage
```

### Manual checks

1. **Upload without checkbox** → blocked in UI (modal; “Continue to upload” disabled until checked).
2. **API without `confirmCopyright`** (expect 400):

   ```bash
   curl -X POST http://localhost:3000/api/admin/media/upload \
     -H "Authorization: Bearer YOUR_JWT" \
     -F "file=@./some.pdf"
   ```

   Expected: `400` with error message about confirming permission.

3. **API with `confirmCopyright`** (expect 201):

   ```bash
   curl -X POST http://localhost:3000/api/admin/media/upload \
     -H "Authorization: Bearer YOUR_JWT" \
     -F "confirmCopyright=true" \
     -F "file=@./some.pdf"
   ```

   Expected: `201` with `{ mediaId, url, ... }`.

4. **UI:** Past paper row shows **Teacher-uploaded** badge; **View uploaded PDF** opens a new tab.

---

## E) PR title + description (copy/paste)

### Title

```
PR-PAST-PAPERS-UI-1: Copyright-safe past papers UI + upload rights confirmation
```

### Description

```
Adds a copyright-safe Past Papers & Exam Resources page that supports teacher-uploaded PDFs only. Introduces a mandatory rights-confirmation modal and enforces the same guardrail server-side via confirmCopyright, returning 400 if missing/false. UI copy avoids "download past papers" language and includes a clear disclaimer that LetsRevise does not provide or distribute official exam materials. Adds test coverage ensuring uploads without confirmation are rejected.
```

---

## CTO note: what’s next (after merge)

1. **Add `GET /api/past-papers/mine`** based on PastPaper model (from PR-BULK-INGEST-4) so the page can list true PastPaper records instead of only topic-past-paper uploads.
2. **Replace any remaining “download” flows** elsewhere with “view attached resource” for consistency.
3. **(Later)** Add institution scope if you introduce schools/tenancy.

*If you want the next PR spec, say: “Generate PR-PAST-PAPERS-API-1 (mine endpoint + filtering)” for a Cursor-ready package.*
