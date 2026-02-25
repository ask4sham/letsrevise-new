# LetsRevise — Production Cycle Status (CTO Handover)

**Stage:** Late MVP build / pre-beta  
**Core reality:** The content factory is strong; the sellable student practice loop is not yet built.

---

## 1) Where we are right now

You are in **late MVP build / pre-beta**.

### ✅ You have
- **AQA core subject taxonomies** (Maths Foundation/Higher, Further Maths, English Lit, English Lang, Sciences) built in the consistent:
  **specKey → JSON → route → tests → SpecSelector** pattern.
- **Guardrails + CI** so future OCR/Edexcel/WJEC additions follow the same factory method.
- **Teacher/admin banks** for:
  - Flashcards
  - Quiz bank
  - Exam questions
  - Past papers + questions
  - Media uploads
  - Content Coverage dashboard (populated vs missing topics)
- **Bulk ingestion tooling** (flashcards, exam questions, past papers, past paper questions) with validation + dedupe + CSV→JSON converters.
- **Copyright-safe ingestion guardrails** for PDFs:
  - Teacher must confirm rights (`confirmCopyright`).

### ⚠️ You do not yet have
- A student practice experience that creates retention/value (the **sellable loop**).
- A public "live" registration + onboarding path (currently local server).
- Enough polished teacher workflows to scale content without friction (Admin ingest UI still pending unless already built).
- Production hosting + billing/subscriptions + school tenancy story (some subscription tests exist, but full story may not).

---

## 2) What is working (confirmed implemented)

### A) Taxonomy & Spec system — Working
- Taxonomies stored as: `backend/config/*_topics.json`
- Each spec has `specKey` and units titled "SS1: …", "SS2: …" where applicable.
- Taxonomy validator + CI enforcement prevents:
  - bad JSON
  - duplicate keys
  - bad slugs
  - colon rules violations
  - etc.
- Frontend SpecSelector supports the added specs.
- Taxonomy API routes exist and are tested.

**Key files**
- `backend/config/*_topics.json`
- `backend/scripts/validateTaxonomies.js`
- `backend/tests/taxonomy.validator.integration.test.js`
- `.github/workflows/ci.yml`
- `CONTRIBUTING.md`, `ARCHITECTURE.md`
- `docs/ADDING_NEW_SUBJECT_SPEC.md`
- `docs/cursor-system-prompt-taxonomy.md`

---

### B) Bulk ingestion pipelines (content scaling foundation) — Working
- Flashcards bulk import (dedupe + topic validation)
- Exam questions bulk import (markScheme required; dedupe; topicKey namespacing)
- Media upload pipeline (local storage + dedupe; served at `/uploads`)
- Past paper + past paper questions models + bulk import + converters
- Attach-from-bank (link teacher's exam questions into a past paper) working
- Manual add past paper question modal working
- Quiz bank supports MCQ + Short Answer import

**Key backend files**
- Validation helpers:
  - `backend/utils/specTopicValidation.js`
  - `assertValidSpecKey`
  - `assertValidSpecTopic`
- Bulk imports:
  - `backend/services/bulkImportFlashcards.js`
  - `backend/services/bulkImportExamQuestions.js`
  - `backend/services/bulkImportPastPapers.js`
  - `backend/services/bulkImportPastPaperQuestions.js`
- Dedupe:
  - `backend/utils/flashcardDedupe.js`
  - `backend/utils/examQuestionDedupe.js`
  - `backend/utils/pastPaperDedupe.js`
  - `backend/utils/pastPaperQuestionDedupe.js`
- CSV converters:
  - `backend/scripts/convertExamQuestionsCsvToJson.js`
  - `backend/scripts/convertPastPapersCsvToJson.js`
  - `backend/scripts/convertPastPaperQuestionsCsvToJson.js`
- Media:
  - `backend/models/Media.js`
  - `backend/routes/adminMedia.js`
  - static hosting in `backend/app.js` for `/uploads`
- Routes:
  - `backend/routes/adminBulkImport.js` (flashcards/exam/past papers etc)
  - `backend/routes/pastPaperQuestions.js` (mine, create, attach-from-bank)
  - `backend/routes/examQuestions.js` (GET `/mine`)
- Tests:
  - `backend/tests/bulkImport.*.integration.test.js`
  - `backend/tests/media.upload.integration.test.js`
  - `backend/tests/pastPaperQuestions.attachFromBank.integration.test.js`

**Key frontend files**
- Past papers UI:
  - `frontend/src/pages/TeacherPastPapersBankPage.tsx`
  - `frontend/src/components/pastPapers/PastPaperDetailPanel.tsx`
  - `frontend/src/components/pastPapers/AddPastPaperQuestionModal.tsx`
  - `frontend/src/components/pastPapers/AttachFromBankModal.tsx`
- Copyright safe UI:
  - `frontend/src/components/pastPapers/CopyrightNotice.tsx`
  - `frontend/src/components/pastPapers/ConfirmUploadRightsModal.tsx`
  - `frontend/src/components/pastPapers/PastPaperUploadButton.tsx`
- APIs:
  - `frontend/src/api/media.ts`
  - `frontend/src/api/pastPapers.ts`
  - `frontend/src/api/pastPaperQuestions.ts`
  - `frontend/src/api/examQuestions.ts`

---

### C) Metadata (difficulty/skill) system — Working
- Difficulty 1–5, skill enum, `estimatedTimeSec` optional.
- Works for exam questions and past paper questions (bulk + manual).
- Filters added on list endpoints + frontend filter components.

**Key files**
- `backend/utils/metadataValidation.js`
- Schema updates:
  - `backend/models/ExamQuestion.js`
  - `backend/models/PastPaperQuestion.js`
- API filters:
  - `backend/routes/examQuestions.js` (GET `/mine`)
  - `backend/routes/pastPaperQuestions.js` (GET `/mine`)
- Frontend:
  - `frontend/src/constants/metadata.ts`
  - `frontend/src/components/filters/DifficultySkillFilter.tsx`
  - Past paper modals + attach-from-bank filter usage

---

### D) Content Coverage dashboard — Working
- `/teacher/content-coverage` shows taxonomy topics with counts across:
  - Flashcards
  - Quiz MCQ
  - Quiz Short
  - Exam Qs
  - Past Paper Qs
- Filter: Missing only / partially / all
- Totals at top

**Key files**
- `backend/routes/topicCoverage.js`
- `backend/tests/topicCoverage.integration.test.js`
- `frontend/src/pages/TeacherCoveragePage.tsx`
- `frontend/src/api/topicCoverage.ts`
- Route added in `frontend/src/App.tsx`
- Link added in `TeacherDashboard.tsx`

---

## 3) What is NOT working / still risky

### A) "Sellable product loop" is missing (highest priority)
Teachers can create content, but **students cannot practice** in a coherent way that shows outcomes and makes the platform valuable.

Needed:
- Practice sets (choose spec → unit → topic → generate questions)
- Student attempts + tracking
- Teacher view of performance by topic (basic analytics)

**This is the #1 blocker to launch-readiness.**

### B) Teacher onboarding / live access isn't ready
- No live system for teachers to register
- Running on local server

Launch-readiness requires:
- Deployed environment (staging + production)
- Teacher registration & auth flows ready publicly
- Basic ops tooling (admin access, monitoring, backups)

### C) Admin ingest UI (optional but huge leverage)
You have scripts + bulk endpoints. If scaling content without dev friction:
- UI upload CSV/JSON
- Preview + validation errors
- Import valid rows only

### D) Copyright risk controls: mostly good, keep sweeping
You already added:
- `confirmCopyright` hard gate for PDFs
- "View uploaded PDF" wording

Still needed:
- Sweep UI for any remaining "download past paper" wording.
- Ensure no public endpoints expose uploaded PDFs unless teacher intends sharing (later: institution scope).

---

## 4) What needs doing to be launch-ready (recommended order)

### Phase 1 — Teachers can build content confidently
- Stabilise banks UX
- Quiz bank imports (MCQ + Short) working + preview layout fixed
- Ensure quiz import validation messages are clear (choices 2–6 etc)
- Admin ingestion UI (if not already done)

**Outcome:** You can create content at volume quickly.

### Phase 2 — Sellable loop
**PR-PRACTICE-LOOP-1**
- Student practice sets from:
  - Quiz bank + exam questions + past paper questions (teacher-authored)
- Attempt tracking:
  - per student, per topicKey, outcome/confidence
- Teacher analytics:
  - topic-level accuracy/attempts, weak topic detection

**Outcome:** Product becomes usable and valuable.

### Phase 3 — Beta-ready operations
- Staging + Production deployment (Docker or managed)
- Teacher registration + admin review/approval
- Emails, password reset
- Data backup strategy

**Outcome:** Teachers can be invited.

### Phase 4 — Scale exam boards
- OCR/Edexcel/WJEC expansion
- Repeat taxonomy/spec factory method per board/spec

**Outcome:** Content coverage expands safely.

---

## 5) Smooth handover notes for next chat

Cursor already has the repo history; continue using the same PR naming scheme:
- `PR-GUARDRAILS-*`
- `PR-BULK-INGEST-*`
- `PR-PAST-PAPERS-UI/API-*`
- `PR-PRACTICE-LOOP-*`
- `PR-METADATA-*`
- `PR-COVERAGE-*`

**Non-negotiables**
- Namespaced topicKey storage: `specKey:topicKey`
- Taxonomy validator must pass
- CI must pass
- No copyrighted ingestion / redistribution
- PDFs require `confirmCopyright === true`
- UI wording must say "View/Open attached resource", not "download past papers"

**Method of working with Cursor (exact workflow)**
Create a PR spec in Cursor-ready form:
- Summary
- Files changed
- Exact edits per file
- Tests to run

Implement changes in Cursor in small commits:
1) commit backend + tests
2) then frontend
3) verify locally
4) merge only when CI passes

---

## 6) Useful verification commands (always)

### Backend
- `cd backend && npm run validate:taxonomies`
- `cd backend && npm test`

Targeted:
- `npx jest tests/topicCoverage.integration.test.js --no-coverage`
- `npx jest tests/media.upload.integration.test.js --no-coverage`

### Frontend
- `cd frontend && npm run build`

---

## 7) Current state snapshot

✅ Confirmed working via screenshots/logs:
- Quiz bank page renders like flashcards (not collapsing)
- Content Coverage page loads and shows missing topics correctly

**Next most valuable step:** Practice Loop (students can practise + teacher sees progress)

---

## 8) PR-PRACTICE-LOOP-1 (Cursor-ready PR spec)

**PR name:** `PR-PRACTICE-LOOP-1-student-practice-attempts-topic-analytics`

### Summary

Implement the minimum sellable practice loop:

- Students can generate a practice set by spec → topic(s) using existing banks (Quiz items, Exam Questions, Past Paper Questions).
- Students can submit attempts (correct/incorrect + optional confidence).
- Teachers can view topic-level performance stats (attempts + accuracy) across their students (or "my students" scope if no classes yet).

This PR intentionally avoids: Class management, assignments, streaks, leaderboards, spaced repetition scheduling, subscriptions, multi-tenancy.

### Assumptions (explicit, so Cursor can execute without ambiguity)

- Backend is Node/Express with Mongoose-style models (based on backend/models/*.js).
- Auth exists enough to distinguish roles (teacher, student) or can be extended minimally.
- Topic keys must remain namespaced: specKey:topicKey.
- Content banks already exist and can be queried with filters (topicKey, difficulty, skill, etc.).
- If role handling is currently only "teacher/admin", add minimal "student" role without breaking existing flows.

### Data model (MVP)

**New model: PracticeAttempt**

- studentId (ObjectId, required)
- teacherId (ObjectId, required) — owner teacher (for analytics / scoping)
- specKey (string, required)
- topicKey (string, required, must be namespaced or store both; see below)
- contentType enum: quiz_mcq | quiz_short | exam_question | past_paper_question
- contentId (ObjectId, required) — id in corresponding collection
- isCorrect (boolean, required)
- confidence optional enum/int (e.g. 1–3) — optional
- timeSpentSec optional
- createdAt (date)

**New model: PracticeSet (optional but recommended for UX)**

- studentId
- teacherId
- specKey
- topicKeys (array of strings)
- items: array of { contentType, contentId, topicKey }
- createdAt
- completedAt optional

If you want to keep it ultra-minimal, skip PracticeSet persistence and generate sets ad-hoc. But persisting it makes the student flow resilient.

### Routes (Backend)

**1) Generate practice set**

`POST /api/practice-sets/generate`

Body:

```json
{
  "specKey": "aqa_gcse_maths_higher",
  "topicKeys": ["aqa_gcse_maths_higher:algebra_linear_equations"],
  "limit": 10,
  "include": ["quiz_mcq", "quiz_short", "exam_question", "past_paper_question"],
  "difficulty": [2,3,4],
  "skill": ["AO1","AO2"]
}
```

Returns:

```json
{
  "practiceSetId": "...",
  "items": [
    {
      "contentType": "exam_question",
      "contentId": "...",
      "topicKey": "aqa_gcse_maths_higher:algebra_linear_equations",
      "prompt": "...",
      "choices": [],
      "answer": null,
      "markScheme": null,
      "metadata": { "difficulty": 3, "skill": "AO2", "estimatedTimeSec": 90 }
    }
  ]
}
```

Security: Student must be authenticated. Generated items must be scoped to the owning teacher's content (or global content if that's your model; default to teacher-owned to be safe).

**2) Submit attempt**

`POST /api/practice-attempts`

Body:

```json
{
  "practiceSetId": "...",
  "contentType": "quiz_mcq",
  "contentId": "...",
  "topicKey": "specKey:topicKey",
  "isCorrect": true,
  "confidence": 2,
  "timeSpentSec": 35
}
```

Stores a PracticeAttempt.

**3) Student history (optional but useful)**

`GET /api/practice-attempts/mine?specKey=...&topicKey=...`

**4) Teacher analytics (topic rollups)**

`GET /api/teacher/analytics/topic-performance?specKey=...`

Returns per topic: attempts count, correct count, accuracy %, lastAttemptAt.

### Files changed (Backend)

**Create:**

- backend/models/PracticeAttempt.js
- backend/models/PracticeSet.js (if persisting sets)
- backend/routes/practiceSets.js
- backend/routes/practiceAttempts.js
- backend/routes/teacherAnalytics.js
- backend/services/generatePracticeSet.js
- backend/tests/practiceSets.generate.integration.test.js
- backend/tests/practiceAttempts.create.integration.test.js
- backend/tests/teacherAnalytics.topicPerformance.integration.test.js

**Edit:**

- backend/app.js (mount new routes)
- backend/utils/specTopicValidation.js (ensure topicKey validation supports namespaced keys coming in from student routes)
- Potentially backend/middleware/auth.js or similar (ensure student role works without breaking teacher flows)

### Exact edits per file (Backend)

**backend/models/PracticeAttempt.js**

- Define schema with indexes: { studentId: 1, createdAt: -1 }, { teacherId: 1, specKey: 1, topicKey: 1 }, { contentType: 1, contentId: 1 } (optional)
- Validate: topicKey must either already be namespaced (specKey:topicKey) OR store specKey separately and enforce topicKey is the raw key. Prefer: store both specKey and namespacedTopicKey (namespacedTopicKey = specKey + ":" + topicKeyRaw) for consistency with existing rules.

**backend/models/PracticeSet.js (if used)**

- Store items array minimal: { contentType, contentId, topicKey }
- Index { studentId: 1, createdAt: -1 }

**backend/services/generatePracticeSet.js**

- Input: specKey, topicKeys, limit, include[], difficulty, skill
- Query sources in priority order: Quiz MCQ, Quiz Short, Exam Questions, Past Paper Questions
- Ensure each item has a topicKey and matches requested filters.
- Dedupe across sources (by contentType+contentId).
- Return items and optionally persist to PracticeSet.
- Keep the returned payload student-safe: For MCQ do NOT include correct choice in payload. For short/exam/past paper do NOT include mark scheme in payload. (Teacher-only endpoints can show mark schemes.)

**backend/routes/practiceSets.js**

- POST /generate — Auth: student required. Validate specKey via assertValidSpecKey, topic keys via assertValidSpecTopic (or a new helper that accepts namespaced keys), limit bounds (e.g. 1–50). Return set.

**backend/routes/practiceAttempts.js**

- POST / — Auth: student required. Validate contentType enum, contentId ObjectId, topicKey valid & namespaced, isCorrect boolean, confidence optional bounds. Persist PracticeAttempt. Return { ok: true }. Also add GET /mine simple listing for student.

**backend/routes/teacherAnalytics.js**

- GET /topic-performance — Auth: teacher required. Aggregate attempts grouped by topicKey: attempts, correct, accuracy = correct/attempts, lastAttemptAt = max(createdAt). Return sorted by attempts desc or lowest accuracy first (recommend lowest accuracy first to surface weaknesses).

**backend/app.js**

- Mount: /api/practice-sets, /api/practice-attempts, /api/teacher/analytics

### Tests (Backend)

Add integration tests mirroring your existing style:

- Generate practice set returns items, respects limit, respects filters.
- Attempt creation works and validates topicKey/specKey.
- Teacher analytics returns correct aggregates.

### Files changed (Frontend)

**Create:**

- frontend/src/pages/StudentPracticePage.tsx
- frontend/src/components/practice/PracticeSetBuilder.tsx
- frontend/src/components/practice/PracticeRunner.tsx
- frontend/src/components/practice/PracticeItemCard.tsx
- frontend/src/api/practiceSets.ts
- frontend/src/api/practiceAttempts.ts
- frontend/src/pages/TeacherTopicPerformancePage.tsx (or embed into dashboard)

**Edit:**

- frontend/src/App.tsx (routes)
- frontend/src/pages/TeacherDashboard.tsx (add link to analytics)
- SpecSelector or wherever spec selection lives (reuse pattern)
- Auth/role routing (if present)

### Exact edits per file (Frontend)

**Student practice UX (minimal)**

- StudentPracticePage.tsx: Step 1 SpecSelector, Step 2 Topic picker (reuse existing taxonomy tree UI patterns from Coverage page if possible), Step 3 Generate → show runner.
- PracticeRunner.tsx: Render one item at a time. For MCQ: show choices, capture selection; on "Check", call attempt endpoint with isCorrect computed client-side using returned correctChoiceIndex? Important: Do NOT send correct answer to client if you want integrity. MVP compromise: include correctChoiceIndex only after submit OR compute server-side. **Recommended: server-side correctness for MCQ** — student submits chosen index, server checks stored correct, server returns result. So update attempt API to accept { "selectedChoiceIndex": 2 } and server sets isCorrect. For short/exam: MVP allow self-marking — student enters answer, clicks "I got it right / wrong", store boolean.

**Teacher analytics page**

- TeacherTopicPerformancePage.tsx: SpecSelector, Table: Topic | Attempts | Accuracy | Last attempt. Link from TeacherDashboard.

**Backend correctness choice (recommended)**

To avoid leaking MCQ answers: For MCQ items returned from generate endpoint include prompt + choices only. For MCQ attempt submission send selectedChoiceIndex; server looks up correct index and stores isCorrect.

### Tests to run

**Backend:**

- `cd backend && npm run validate:taxonomies`
- `cd backend && npm test`
- Targeted: npx jest tests/practiceSets.generate.integration.test.js --no-coverage, npx jest tests/practiceAttempts.create.integration.test.js --no-coverage, npx jest tests/teacherAnalytics.topicPerformance.integration.test.js --no-coverage

**Frontend:**

- `cd frontend && npm run build`

### Commit plan (Cursor workflow)

1. Backend + tests (models, services, routes, integration tests)
2. Frontend (student practice page + minimal runner, teacher analytics page)
3. Verify locally with commands above
4. Merge only once CI passes

---

## 9) Launch scope sanity-check (Cursor-ready)

### Goal of the first launch

A teacher can: onboard (even if invite-only), add/import content (already strong), invite a small group of students, students practise by topic, teacher sees weak topics. If that is true, you have something people will use and talk about.

### What you should ship in "Beta 1" (minimum sellable)

**A) Student practice loop (must-have)** — Generate practice set by topic, attempt tracking, teacher topic analytics. This is PR-PRACTICE-LOOP-1.

**B) Invite-only onboarding (good enough)** — You do not need full public self-serve yet. Ship: Teacher accounts created by admin (manual), Student accounts created by teacher (manual) OR invite codes (simple). Password reset can be postponed if you keep cohort tiny.

**C) Production basics (don't overbuild)** — Ship: Staging + production deploy, Backups (daily snapshot), Error logging (even minimal), Admin access path. Do not ship: subscriptions/billing, school tenancy, complex RBAC until usage proves value.

### What to defer (it will eat weeks)

Full school tenancy model, Billing/subscriptions, Class / assignment / homework scheduling, Advanced analytics dashboards, Automated marking for long answers, Spaced repetition / retention algorithms, Multi-board expansion. These are multipliers after the loop is validated.

### "2–4 week" realistic milestone plan (solo builder)

- **Week 1–2: Value loop** — PR-PRACTICE-LOOP-1 end-to-end, stable. Teacher topic analytics visible and correct.
- **Week 2–3: Ops + onboarding** — Deploy staging/prod. Invite-only auth flows. Backups + basic monitoring.
- **Week 3–4: Polish + friction removal** — Student UX polish (loading states, empty states, retry). Teacher workflow quick wins (import preview clarity, better validation messages). Copyright wording sweep.

### Success criteria (binary, not vibes)

You're launch-ready when all 3 are true:

1. A student can do 10 minutes of practice without confusion.
2. A teacher can answer: "Which topics are weakest?" in under 30 seconds.
3. You can invite 5 teachers without manual firefighting (deploy + auth + basic ops).

### Immediate next actions (what to do now)

1. Implement PR-PRACTICE-LOOP-1
2. Add invite-only onboarding + deploy
3. Recruit 3–5 teachers for beta and measure: time-to-first-practice, attempts per student per week, topics practiced per week, teacher return rate

That's enough to decide what to build next with confidence.
