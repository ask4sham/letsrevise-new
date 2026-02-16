# Full Site Functionality Audit — LetsRevise

**Date:** 2025-02-10  
**Scope:** Identity, entitlements, lessons, AI, question bank, media, progress, curriculum.  
**North star:** GCSE Biology AQA Foundation/Higher AI lesson factory (minimum input → full lesson + diagrams + questions).

---

## 1) Capability Map (✅ working | ⚠️ partial | ❌ missing)

| Domain | Status | Notes |
|--------|--------|-------|
| **A) Identity & roles** | ✅ | JWT auth, userType (student/teacher/admin/parent), ProtectedRoute with requireTeacher/requireStudent/requireAdmin/requireParent |
| **B) Entitlements & paywalls** | ✅ | subscriptionV2 contract, LessonUnlock, FREE_PREVIEW (allowed:false + reason), applyLessonAccess/canAccessContent; paywall events + admin metrics |
| **C) Lesson system** | ✅ | pages/blocks schema, draft/in_review/published, teacher editor, student view, preview sanitization, list + card description |
| **D) Existing AI generation** | ⚠️ | Lesson draft (OpenAI) + revision (slot engine); slot script can stub or call OpenAI; no full “topic → lesson + diagrams + questions” pipeline |
| **E) Question bank & assessment papers** | ✅ | ExamQuestion CRUD, assessment papers CRUD, PATCH questions (ObjectId-safe), attempts/results flow; TeacherExamQuestionBankPage has “Image upload — not connected yet” |
| **F) Media / diagrams / images** | ⚠️ | Local uploads + Supabase media block; curated visuals (VisualModel); no AI diagram generation |
| **G) Progress, reports, monitoring** | ✅ | Progress/review routes gated by canAccessContent; admin metrics (paywall, preview, CTA); ops playbooks for OPENAI/ENGINE spikes |
| **H) Curriculum / exam board** | ⚠️ | examBoard/tier/board in Lesson (board in DB), AQA/GCSE in filters; curriculum-confidence + static spec files; no full taxonomy API for “GCSE Biology AQA” spec mapping |

---

## 2) Source of truth files per domain

### A) Identity & roles
- **Backend:** `backend/middleware/auth.js` (JWT verify, req.user, subscriptionV2 normalize), `backend/routes/auth.js`, `backend/models/User.js` (userType, subscriptionV2)
- **Frontend:** `frontend/src/App.tsx` (ProtectedRoute, readAuthFromStorage), `frontend/src/services/api.ts` (axios interceptors, baseURL)

### B) Entitlements & paywalls
- **Backend:** `backend/utils/canAccessContent.js`, `backend/contracts/subscriptionV2.js`, `backend/models/LessonUnlock.js`, `backend/middleware/canAccessContent.js` (applyLessonAccess), `backend/middleware/applyLessonAccess.js`
- **Frontend:** `frontend/src/components/LessonAccessBadge.tsx`, `frontend/src/utils/events.ts` (logPaywallEvent), `frontend/src/pages/LessonViewPage.tsx` (FREE_PREVIEW_VIEW, Subscribe CTA), `frontend/src/pages/AdminMetricsPage.tsx`

### C) Lesson system
- **Backend:** `backend/models/Lesson.js`, `backend/routes/lessons.js`, `backend/utils/lessonPayload.js`, `backend/utils/deriveLessonCardDescription.js`, `backend/utils/canAccessContent.js`
- **Frontend:** `frontend/src/pages/EditLessonPage.tsx`, `frontend/src/pages/LessonViewPage.tsx`, `frontend/src/pages/CreateLessonPage.tsx`, `frontend/src/pages/BrowseLessonsPage.tsx`, `frontend/src/pages/StudentDashboard.tsx`

### D) AI generation
- **Backend:** `backend/routes/ai.js` (POST /generate-lesson, /generate-and-save), `backend/routes/lessons.js` (POST /:id/generate-revision, GET /:id/revision-draft), `backend/services/generateRevision.js`, `backend/services/validateRevision.js`
- **Scripts:** `scripts/run-slot-generation-openai.js`, `docs/curriculum/engine/slot-generation-*.json`, `docs/curriculum/engine/slot-generation-prompt*.md`
- **Frontend:** `frontend/src/pages/TeacherDashboard.tsx` (Generate with AI), `frontend/src/pages/EditLessonPage.tsx`, `frontend/src/pages/LessonViewPage.tsx` (Generate revision with AI)

### E) Question bank & assessment papers
- **Backend:** `backend/models/ExamQuestion.js`, `backend/models/AssessmentPaper.js`, `backend/models/AssessmentItem.js`, `backend/routes/examQuestions.js`, `backend/routes/assessmentPapers.js`, `backend/routes/assessmentAttempts.js`, `backend/routes/assessmentItems.js`
- **Frontend:** `frontend/src/pages/TeacherExamQuestionBankPage.tsx`, `frontend/src/pages/AssessmentPaperEditPage.tsx`, `frontend/src/pages/AssessmentPapersList.tsx`, `frontend/src/pages/AssessmentPaperStartPage.tsx`, `frontend/src/pages/AssessmentPaperAttemptPage.tsx`, `frontend/src/pages/AssessmentPaperResultsPage.tsx`

### F) Media / diagrams / images
- **Backend:** `backend/routes/uploads.js` (local disk), `backend/routes/media.js` (Supabase lesson-block), `backend/utils/curatedVisuals.js`, `backend/models/VisualModel.js`, `backend/routes/visuals.js`
- **Frontend:** `frontend/src/pages/EditLessonPage.tsx` (Supabase + /api/uploads/image), `frontend/src/components/lesson/ImageUploader.tsx`, `frontend/src/lib/supabaseClient.ts`

### G) Progress, reports, monitoring
- **Backend:** `backend/routes/progress.js`, `backend/routes/reviews.js`, `backend/routes/admin.js` (metrics, top-paywalled, set-free-preview, entitlement diagnose), `backend/routes/events.js`, `backend/models/Event.js`, `backend/services/revisionMetrics.js`, `backend/ops/`
- **Frontend:** `frontend/src/pages/AdminMetricsPage.tsx`, `frontend/src/pages/AdminDashboardPage.tsx`, `frontend/src/pages/StudentProgressPage.tsx`, `frontend/src/pages/AnalysisPage.tsx`

### H) Curriculum / exam board
- **Backend:** `backend/routes/curriculumConfidence.js` (single lessonId, static JSON), `backend/routes/lessons.js` (board, tier, level filters), `backend/utils/curatedVisuals.js` (examBoard/subject/level/topic)
- **Docs:** `docs/curriculum/statutory/england-gcse-biology.v1.json`, `docs/curriculum/boards/aqa-gcse-biology-photosynthesis.v1.json`, `docs/curriculum/mappings/`, `docs/curriculum/engine/`

---

## 3) Known bugs / regressions

- **Lesson list select vs schema:** `GET /api/lessons` and `POST /api/lessons/by-ids` use `.select("... examBoard ...")` but `Lesson` schema has `board`, not `examBoard`. List may return undefined for examBoard; frontend may rely on `board` or a different field. **Files:** `backend/routes/lessons.js` (e.g. 2042, 2188).
- **Hardcoded localhost in frontend:** Several pages use `http://localhost:5000` instead of shared api baseURL: `SubscriptionPage.tsx`, `AssessmentPapersList.tsx`, `Dashboard.tsx`, `FlashcardsEditorPage.tsx`, `AdminLessonViewPage.tsx`, `ReviewList.tsx`, `TestYourKnowledge.tsx`, `EnhancedLessonView.tsx`, `RegisterForm.tsx`, `TeacherPayoutPage.tsx`, `NotificationBell.tsx`, etc. **Risk:** Fails in staging/production unless env is set.
- **SubscriptionPage / payouts / notifications:** Use raw `fetch('http://localhost:5000/...')`; should use `api` from `services/api.ts` or env-based base.
- **AssessmentPapersList.tsx:** `const url = \`http://localhost:5000/api/assessment-papers?kind=...\`` — should use api client and env.
- **Progress route:** Uses `user.purchasedLessons` for update but entitlement allows SUB_ACTIVE; if a subscriber has no purchased lesson entry, progress update returns “You must purchase this lesson first” (logic may be too strict for subscribers). **File:** `backend/routes/progress.js` (e.g. 70–72).
- **Curriculum confidence:** Hardcoded paths to single statutory + single board spec (`england-gcse-biology.v1.json`, `aqa-gcse-biology-photosynthesis.v1.json`); returns same payload for any lessonId. **File:** `backend/routes/curriculumConfidence.js`.

No exact stack traces were found in the repo; the above are logical/consistency issues.

---

## 4) Gap list for GCSE Biology AI lesson factory

Minimum input → full lesson + diagrams + questions:

| Gap | Current state | Needed for factory |
|-----|----------------|---------------------|
| **Single “topic + board + tier” → lesson** | AI generates draft from topic/subject/level/board/tier and can “generate-and-save”; no one-shot “GCSE Biology AQA Foundation: Topic X” API that returns a full lesson with pages. | One orchestrated endpoint or flow: input (e.g. topic, examBoard=AQA, tier=foundation) → create lesson + run lesson generation + attach curriculum/spec. |
| **Diagrams in lesson** | Curated visuals (VisualModel) and hero images; no AI-generated diagrams. | Either: (1) AI diagram generation (image gen API) and store as block/page asset, or (2) map topic → curated diagram IDs and attach visualModelId to pages. |
| **Questions in lesson** | Lesson has in-page checkpoints + optional quiz/flashcards; revision AI generates flashcards+quiz from pages. Exam question bank is separate (ExamQuestion); papers combine items + questionBankIds. | Clear path: either (1) generate checkpoint/quiz items from AI and save into lesson, or (2) generate ExamQuestions and attach to a default paper, or both. No single “generate lesson + all questions” pipeline. |
| **Spec mapping** | curriculumConfidence is placeholder (static file per lesson); board/tier/topic exist on Lesson and in filters. | Taxonomy/spec API or mapping: given subject/level/board/tier/topic return spec points (and optionally lesson-side coverage) so AI prompts can be spec-aligned. |
| **Revision from new lesson** | Revision generation requires lesson to have pages; generate-revision writes to LessonRevisionDraft; teacher applies draft to lesson. | Already sufficient for “after lesson is created”; ensure “generate-and-save” produces pages so “generate-revision” can run. |
| **Allowlist/rollout** | Slot engine (revision) uses allowlist + rollout %; lesson draft in ai.js uses OpenAI directly with no allowlist. | If factory uses slot engine for any step, allowlist must include GCSE Biology AQA; if all via ai.js, no allowlist (but rate/cost control needed). |

---

## 5) Suggested next 5 PR-sized steps

1. **Fix lesson list “examBoard” vs “board”**  
   In `backend/routes/lessons.js`, change list/by-ids select and any response shape to use `board` (or add a virtual/alias so list returns both). Ensure frontend card/list use the same field. Small, testable, no new features.

2. **Use shared API base everywhere**  
   Replace hardcoded `http://localhost:5000` in SubscriptionPage, AssessmentPapersList, Dashboard, FlashcardsEditor, AdminLessonView, ReviewList, TestYourKnowledge, EnhancedLessonView, RegisterForm, TeacherPayoutPage, NotificationBell with `api` from `frontend/src/services/api.ts` or `process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL`. Add a short checklist in a comment or doc. Test: run frontend with `REACT_APP_API_BASE=http://localhost:5000` and verify list/subscribe/notifications.

3. **GCSE Biology AQA allowlist + rollout**  
   In `docs/curriculum/engine/slot-generation-allowlist.v1.json`, ensure a rule enables subject=Biology, level=GCSE, board=AQA for revision (and any future lesson-level slot). Optionally set `SLOTGEN_AI_ROLLOUT_PERCENT` for a small % and verify one generate-revision flow end-to-end.

4. **Topic → curated visual for new lessons**  
   When creating or “generate-and-save” a lesson for AQA GCSE Biology, call `findCuratedVisual({ subject, examBoard, level, topic })` and attach returned visual to first page (or hero) so new lessons get a diagram without AI image gen. Reuse logic already in `backend/routes/lessons.js` (e.g. around 498–509). Test: create lesson with topic that has a curated visual and confirm lesson view shows it.

5. **Single “factory” endpoint (or documented flow)**  
   Add POST e.g. `/api/ai/generate-lesson-and-revision` or document the exact sequence: (1) POST /api/ai/generate-and-save (topic, subject, level, board, tier), (2) GET lesson by id, (3) POST /api/lessons/:id/generate-revision, (4) optional PATCH to attach curated visual. Backend can either implement one handler that does 1–3 or a small script/docs for teachers. Keeps changes minimal while giving a clear “minimum input → lesson + revision” path.

---

## 6) Commands to verify

```bash
# Repo structure
ls -la backend/routes frontend/src/pages

# Entitlements / paywall
rg -n "applyLessonAccess|canAccessContent|FREE_PREVIEW|LessonUnlock|subscriptionV2" backend frontend --glob '*.{js,ts,tsx}'

# AI
rg -n "openai|generateRevision|run-slot-generation|generate-lesson|generate-and-save" backend scripts --glob '*.js'

# Assessment / ObjectId
rg -n "ObjectId|assessment-papers|exam-questions|questionBankIds" backend --glob '*.js'

# API base in frontend
rg -n "localhost:5000|REACT_APP_API_BASE|REACT_APP_API_URL|baseURL" frontend/src

# Lesson routes and middleware
rg -n "router\.(get|post|put|delete|patch)" backend/routes/lessons.js
rg -n "applyLessonAccess\(" backend/routes

# Unit / integration tests
cd backend && npx jest backend/tests/canAccessContent.test.js --testPathIgnorePatterns=''
npx jest backend/tests/subscriptionV2.contract.test.js --testPathIgnorePatterns=''
npx jest backend/tests/lessonsContentAccess.integration.test.js --testPathIgnorePatterns=''
npx jest backend/tests/assessmentAttempts.integration.test.js --testPathIgnorePatterns=''
```

**Suggested manual/curl checks:**
- Auth: `curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"...","password":"..."}'`
- Lesson list (student): `curl -H "Authorization: Bearer <token>" "http://localhost:5000/api/lessons?level=GCSE&subject=Biology"`
- Lesson by id (gated): `curl -H "Authorization: Bearer <token>" "http://localhost:5000/api/lessons/<id>"`
- Paywall event: `curl -X POST http://localhost:5000/api/events -H "Content-Type: application/json" -d '{"type":"FREE_PREVIEW_VIEW","lessonId":"<id>"}'`
- AI generate-and-save: `curl -X POST http://localhost:5000/api/ai/generate-and-save -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"topic":"Photosynthesis","subject":"Biology","level":"GCSE","board":"AQA","tier":"higher"}'`

---

## Lesson-affecting endpoints and middleware (summary)

| Method | Path | Middleware | Notes |
|--------|------|------------|-------|
| GET | /api/lessons/_ping | none | Ping |
| GET | /api/lessons | auth | List; student level enforced; canAccessContent per row |
| GET | /api/lessons/:id | auth, applyLessonAccess({ requirePublished: true }) | Single lesson; FREE_PREVIEW → preview payload |
| POST | /api/lessons | auth | Create (teacher) |
| PUT | /api/lessons/:id | auth | Update (owner/admin); status rules |
| POST | /api/lessons/:id/generate-revision | auth | Owner/admin; DISABLE_AI_REVISION_GENERATION=1 → 503 |
| GET | /api/lessons/:id/revision-draft | auth | Owner/admin |
| POST | /api/lessons/:id/submit-review | auth | Owner; draft → in_review |
| POST | /api/lessons/by-ids | auth | List by ids |
| GET | /api/reviews/lesson/:lessonId | auth, applyLessonAccess({ requirePublished: true }) | Reviews for lesson |
| POST | /api/reviews/:lessonId | auth, applyLessonAccess({ requirePublished: true }) | Submit review |
| POST | /api/media/lesson-block | auth, upload.single("file"), applyLessonAccess({ allowBody: true, requirePublished: true }) | Upload media for lesson block |
| GET | /api/curriculum-confidence/:lessonId | auth, applyLessonAccess({ requirePublished: true }) | Curriculum payload (static) |
| PUT | /api/progress/:lessonId | auth | Progress update; canAccessContent inside handler |
| PUT | /api/progress/:lessonId/review | auth | Review; canAccessContent inside handler |

Admin lesson routes (admin.js): grant/revoke unlock, admin get/put/delete lessons, set-free-preview, status, etc. — all auth + checkAdmin.

---

## Per-domain detail (status, what it does, key files, tests, risks)

### A) Identity & roles
- **Status:** ✅ Working  
- **What it does:** Login/register issue JWT; auth middleware verifies JWT (Bearer or x-auth-token), loads user, normalizes subscriptionV2. Frontend stores auth in localStorage; ProtectedRoute checks userType and redirects by role (student/teacher/admin/parent).  
- **Key files:** `backend/middleware/auth.js`, `backend/routes/auth.js`, `frontend/src/App.tsx`, `frontend/src/services/api.ts`  
- **Tests:** No dedicated auth integration test in backend/tests; canAccessContent and subscriptionV2 have unit tests.  
- **Risks:** JWT_SECRET_KEY must be set; frontend auth is sync from localStorage (no refresh token flow documented).

### B) Entitlements & paywalls
- **Status:** ✅ Working  
- **What it does:** canAccessContent: admin → allow; then published check; then SUB_ACTIVE, LESSON_UNLOCK, PURCHASED → allow; isFreePreview → allowed:false, reason FREE_PREVIEW; else NOT_ENTITLED. applyLessonAccess middleware uses it; GET /api/lessons/:id returns preview payload for FREE_PREVIEW. Events: PAYWALL_NOT_ENTITLED, FREE_PREVIEW_VIEW, SUBSCRIBE_CTA_CLICK to POST /api/events. Admin metrics: top-paywalled, preview CTA, totals.  
- **Key files:** `backend/utils/canAccessContent.js`, `backend/middleware/canAccessContent.js`, `backend/utils/lessonPayload.js`, `frontend/src/utils/events.ts`, `frontend/src/pages/AdminMetricsPage.tsx`  
- **Tests:** `backend/tests/canAccessContent.test.js`, `backend/tests/lessonsContentAccess.integration.test.js`  
- **Risks:** None critical; ensure Event model and admin queries are indexed for lessonId/type/date.

### C) Lesson system
- **Status:** ✅ Working  
- **What it does:** Lesson has pages[] (pageId, title, order, blocks, checkpoint, optional visualModelId), status draft/in_review/published; teacher editor (EditLessonPage) supports block types text/keyIdea/examTip/commonMistake/stretch; student view uses applyLessonAccess and preview sanitization (first page, no quiz, checkpoint answers stripped). List uses LIST_SAFE_KEYS and deriveLessonCardDescription; canAccessContent per row with unlockSet.  
- **Key files:** `backend/models/Lesson.js`, `backend/routes/lessons.js`, `backend/utils/lessonPayload.js`, `backend/utils/deriveLessonCardDescription.js`, `frontend/src/pages/EditLessonPage.tsx`, `frontend/src/pages/LessonViewPage.tsx`  
- **Tests:** `backend/tests/lessonsContentAccess.integration.test.js`, `backend/tests/lessonReviewWorkflow.integration.test.js`, `backend/tests/revisionDraft.integration.test.js`, `backend/tests/Lesson.status.validation.test.js`  
- **Risks:** List select uses `examBoard` while schema has `board` (see bugs). Frontend must not send unsanitized HTML in blocks (markdown only).

### D) Existing AI generation
- **Status:** ⚠️ Partial  
- **What it does:** (1) POST /api/ai/generate-lesson: OpenAI structured output → lesson draft (pages, checkpoints); (2) POST /api/ai/generate-and-save: template clone + AI fill + save; (3) POST /api/lessons/:id/generate-revision: buildRevisionJobSpec → runSlotEngine (scripts/run-slot-generation-openai.js) → validateAndNormalizeRevision → LessonRevisionDraft. Slot script: allowlist + rollout + OPENAI_API_KEY; can return STUB (NOT_ALLOWLISTED, ROLLOUT_EXCLUDED, KILL_SWITCH) or call OpenAI for revision. No diagram generation; no single “topic → full lesson + diagrams + questions” pipeline.  
- **Key files:** `backend/routes/ai.js`, `backend/services/generateRevision.js`, `scripts/run-slot-generation-openai.js`, `docs/curriculum/engine/slot-generation-allowlist.v1.json`, `docs/curriculum/engine/slot-generation-prompt.revision.openai.v1.md`  
- **Tests:** `scripts/__tests__/run-slot-generation-openai.test.js`; no integration test for generate-and-save or generate-revision in backend/tests.  
- **Risks:** DISABLE_AI_REVISION_GENERATION=1 disables revision; OPENAI_API_KEY required for real revision; allowlist must include GCSE Biology AQA for production.

### E) Question bank & assessment papers
- **Status:** ✅ Working  
- **What it does:** ExamQuestion: teacher CRUD; filters subject, examBoard, level, topic, type, status. AssessmentPaper: items (AssessmentItem refs) + questionBankIds (ExamQuestion refs); CRUD; PATCH /:id/questions with addExamQuestionIds/removeExamQuestionIds (ObjectId validated, raw collection update to avoid Mongoose cast). Attempts: create, answer, submit, results.  
- **Key files:** `backend/models/ExamQuestion.js`, `backend/routes/examQuestions.js`, `backend/routes/assessmentPapers.js` (incl. PATCH questions), `backend/routes/assessmentAttempts.js`, `frontend/src/pages/TeacherExamQuestionBankPage.tsx`, `frontend/src/pages/AssessmentPaperEditPage.tsx`  
- **Tests:** `backend/tests/assessmentAttempts.integration.test.js`  
- **Risks:** TeacherExamQuestionBankPage “Image upload — not connected yet”. Paper GET merges items + questionBankIds; ensure ordering and marks are correct when both are present.

### F) Media / diagrams / images
- **Status:** ⚠️ Partial  
- **What it does:** Uploads: POST /api/uploads/image (multer, local disk under backend/uploads); POST /api/uploads/lesson-image. Media: POST /api/media/lesson-block (Supabase bucket, auth + applyLessonAccess). Curated visuals: findCuratedVisual by subject/examBoard/level/topic; attach to lesson pages or hero in create/update. VisualModel and /api/visuals; seed scripts for AQA Biology. No AI-generated diagrams.  
- **Key files:** `backend/routes/uploads.js`, `backend/routes/media.js`, `backend/utils/curatedVisuals.js`, `backend/models/VisualModel.js`, `frontend/src/pages/EditLessonPage.tsx` (Supabase + uploads)  
- **Tests:** None found for uploads or media.  
- **Risks:** Two paths (local vs Supabase); frontend must use correct endpoint per context. Diagram generation is the main gap for “full lesson + diagrams”.

### G) Progress, reports, monitoring
- **Status:** ✅ Working  
- **What it does:** Progress: PUT /api/progress/:lessonId (student, canAccessContent, updates purchasedLessons progress). Reviews: GET/POST with applyLessonAccess. Events: POST /api/events for paywall types. Admin: metrics (totals, daily), top-paywalled, top without preview, entitlement diagnose, set-free-preview. Ops: revisionMetrics, OPENAI/ENGINE playbooks.  
- **Key files:** `backend/routes/progress.js`, `backend/routes/reviews.js`, `backend/routes/events.js`, `backend/routes/admin.js`, `backend/services/revisionMetrics.js`  
- **Tests:** lessonReviewWorkflow, assessmentAttempts (subscriptionV2), ops* tests.  
- **Risks:** Progress handler requires purchased lesson entry even for subscribers (see bugs). Events anonymous when no token.

### H) Curriculum / exam board
- **Status:** ⚠️ Partial  
- **What it does:** Lesson has board, tier, level, topic. List and filters use board, tier (GCSE only), level. curriculumConfidence/:lessonId returns static statutory + one board spec (same for all lessons). Curated visuals and seed data use examBoard (AQA) and topic. Docs: statutory, boards, mappings, engine schemas.  
- **Key files:** `backend/routes/curriculumConfidence.js`, `backend/routes/lessons.js` (filters), `docs/curriculum/`  
- **Tests:** None for curriculum.  
- **Risks:** curriculumConfidence is placeholder; no API to list spec points by subject/level/board/tier for AI or UI.

---

*End of audit.*
