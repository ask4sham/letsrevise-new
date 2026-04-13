# LetsRevise Product Capability Audit Report

**Date:** March 2025  
**Baseline:** `last-working-state` tag, `content-dev` branch

---

## Executive Summary

LetsRevise is a UK curriculum revision platform (GCSE, A-Level, KS3) with teacher content creation, AI-assisted generation, student learning, and admin operations. **Most core features are implemented and stable.** Auth and roles are fully working. Lesson creation and editing are mature. AI generation exists (Biology-first; other specs via `generate-and-save`). The content system (taxonomy, topic banks, flashcards, quizzes, worksheets) is built and integrated. Media uploads work (Supabase/R2/local). Dashboards and mobile layout are functional. A few items (lesson reviews for Supabase lessons, some admin controls) are partial or placeholder. **The platform is ready for content-first work** — leave auth, lesson editor, media, and dashboards alone; focus on content production.

---

## 1. CORE USER ROLES

| Role | Login | Dashboards/Routes | Restrictions |
|------|-------|-------------------|--------------|
| **student** | `/login` (role selector) | `/student-dashboard`, `/student/lesson/:id`, `/student/my-work`, `/student/my-progress`, `/student/practice`, etc. | No teacher/admin routes; `requireStudent` on lesson routes |
| **teacher** | `/login` | `/teacher-dashboard`, `/create-lesson`, `/edit-lesson/:id`, `/teacher/topic-banks/*`, `/teacher/content-coverage`, `/coverage`, etc. | No admin-only routes |
| **parent** | `/login` | `/parent-dashboard` | Limited to parent view |
| **admin** | `/admin-login` (hidden) | `/admin`, `/admin/metrics`, `/admin/audit-log`, `/admin/lesson/:id`, `/admin/topic/:specKey/:topicKey`, etc. | Rejects non-admin at login |
| **content_manager** | `/admin-login` | Same as admin for content routes; `requireAdminOrContentManager` on taxonomy, content-coverage, autopilot, spec-statements, etc. | No `/admin/metrics`, `/admin/audit-log`, `/admin/topic/:specKey/:topicKey` (admin-only) |

**Files:** `App.tsx` (routes, ProtectedRoute, RoleBasedRedirect), `LoginPage.tsx`, `RegisterPage.tsx`, `AdminLoginPage.tsx`, `backend/models/User.js`

---

## 2. AUTHENTICATION & ACCOUNT MANAGEMENT

| Item | Status | Notes |
|------|--------|-------|
| Signup | **Fully working** | `RegisterPage.tsx` — student/teacher/parent, password validation |
| Login/logout | **Fully working** | `LoginPage.tsx`, `clearAuth` on logout |
| Hidden admin login | **Fully working** | `/admin-login`, rejects non-admin |
| Email verification | **Fully working** | `VerifyEmailPage.tsx` |
| Resend verification | **Fully working** | Via verify-email flow |
| Forgot password | **Fully working** | `ForgotPasswordPage.tsx` |
| Reset password | **Fully working** | `ResetPasswordPage.tsx` |
| Change password | **Fully working** | `SettingsPage.tsx` → `PUT /auth/me/password`, strength validation, eye toggles |
| Change email | **Fully working** | `SettingsPage.tsx` → `PUT /auth/me/email` |
| Non-admin email-change reverification | **Fully working** | `ConfirmEmailChangePage.tsx` |
| Protected routes | **Fully working** | `ProtectedRoute`, `requireTeacher`, etc. |
| Admin-only access | **Fully working** | `requireAdmin` |
| content_manager access | **Fully working** | `requireAdminOrContentManager` |

---

## 3. LESSON CREATION CAPABILITIES

| Capability | Status | File/Route |
|------------|--------|------------|
| Create lesson title, subject, board, level, topic | **Fully working** | `CreateLessonPage.tsx`, `EditLessonPage.tsx` |
| Syllabus mapping | **Fully working** | Taxonomy selectors, `topicKey`, `specKey` |
| Duration | **Fully working** | `estimatedDuration` |
| Description | **Fully working** | `description` field |
| Multi-page structure | **Fully working** | `pages[]` with `pageId`, `title`, `order`, `blocks` |
| Add page types | **Fully working** | Page CRUD in editor |
| Add text blocks | **Fully working** | `text`, markdown |
| Key ideas | **Fully working** | `keyIdea` block type |
| Key words | **Fully working** | `keyWords` block type |
| Exam tips | **Fully working** | `examTip` block type |
| Misconceptions | **Fully working** | `commonMistake` block type |
| Deeper knowledge | **Fully working** | `stretch` block type |
| Checkpoints | **Fully working** | `checkpoint` block, `LessonCheckpoint` |
| Diagrams | **Fully working** | `diagram` block, AI diagram generation |
| Image upload | **Fully working** | `ImageUploader.tsx` → `POST /api/uploads/image` |
| Video upload | **Fully working** | `POST /api/uploads/video` |
| Quiz attachment | **Fully working** | Attach from question bank, page quiz |
| Preview | **Fully working** | Draft state, edit flow |
| Publish / save draft | **Fully working** | `PATCH /lessons/:id`, publish gate |

---

## 4. AI LESSON GENERATION CAPABILITIES

| Capability | Status | Notes |
|------------|--------|-------|
| Teacher AI modal | **Implemented** | `TeacherDashboard.tsx` — subject/spec/topic/tier selection |
| Lesson factory (Biology) | **Implemented** | `POST /api/ai/lesson-factory/aqa-gcse-biology` |
| Generate for uncovered topics | **Implemented** | AQA GCSE Biology only |
| Generate-and-save | **Implemented** | `POST /api/ai/generate-and-save` for full spec coverage |
| Starter pack | **Implemented** | `postGenerateStarterPack` → lesson + flashcards + quiz + exam |
| Diagram generation | **Implemented** | In-editor `POST /api/ai/generate-diagram` |
| Autopilot approval/runs/outcomes/feedback/experiments | **Implemented** | Content coverage flow, approval queue, draft library |
| Auto-attach flashcards/quizzes | **Partial** | Via starter pack; topic bank linkage exists |
| Auto-create diagrams/images | **Partial** | Diagram generation; image generation may be limited |

**Limitation:** Biology-first; other specs use `generate-and-save` or similar.

---

## 5. CONTENT SYSTEM / CURRICULUM CAPABILITIES

| Component | Admin | Teacher | Functional? |
|-----------|-------|---------|-------------|
| Taxonomy | `AdminTaxonomyPage`, `/admin/taxonomy` | Used in CreateLesson, coverage | **Yes** |
| Spec statements | `SpecStatementsPage`, `/admin/spec-statements` | Ingest, list | **Yes** |
| Topic bank coverage | `ContentCoveragePage` | `TeacherCoveragePage`, `CoverageDashboardPage` | **Yes** |
| Flashcards | `AdminQuestionBanksPage` (admin view) | `TeacherFlashcardBankPage`, `FlashcardsEditorPage` | **Yes** |
| Quizzes | — | `TeacherQuizBankPage`, `CreateQuizPage` | **Yes** |
| Past papers | — | `TeacherPastPapersBankPage` | **Yes** |
| Worksheets | — | `TeacherWorksheetBuilderPage` | **Yes** |
| Autopilot (approval, runs, outcomes, feedback, experiments) | `AutopilotApprovalPage`, etc. | — | **Yes** |
| Draft library | `DraftLibraryPage` | — | **Yes** |
| Content issues | `ContentIssuesPage` | `ContentIssuesPage` (teacher can access) | **Yes** |

---

## 6. MEDIA / IMAGE CAPABILITIES

| Item | Status | Notes |
|------|--------|-------|
| Image upload | **Stable** | `ImageUploader.tsx`, `POST /api/uploads/image` |
| Storage provider | **Stable** | Supabase when configured; fallback R2 or local |
| Persistence across deploys | **Stable** | Supabase/R2 persist; Netlify redirects `/uploads/*` to Render |
| Lesson rendering | **Stable** | `assetUrl.ts`, `mediaUrl.ts`, `preprocessMarkdownAssetUrls` |
| Editor preview | **Stable** | In EditLessonPage |
| Legacy image handling | **Stable** | Migration scripts exist; `makeAbsoluteAssetUrl` |

---

## 7. DASHBOARDS

| Dashboard Section | Data/Actions | Read-only? | Placeholder? |
|-------------------|-------------|------------|-------------|
| Teacher Dashboard | Lessons, stats, coverage, AI modal, needs marking | Mix | No |
| Admin Dashboard | Users, lessons, transactions, templates | Mix | No |
| User management | Real | No | No |
| Lesson management | Real | No | No |
| Template management | Real | No | No |
| Transactions | Real | Yes (view) | No |
| Audit log | Real | Yes | No |
| Coverage / taxonomy / question bank / content issues | Real | Mix | No |
| AI coverage / paywall metrics | Real | Yes | No |

**AdminLessonViewPage:** Some controls (e.g. isFreePreview) may be TODO/partial.

---

## 8. MOBILE / RESPONSIVE STATUS

| Flow | Status |
|------|--------|
| Login/register | **Good** |
| Lesson view | **Good** — `layoutStacked`, matchMedia + innerWidth fallback, portal nav, bottom bar |
| Teacher dashboard | **Usable** |
| Lesson editor | **Usable but rough** — complex; may need tuning |
| Admin dashboard | **Usable** |

---

## 9. CAPABILITY SUMMARY TABLE

| Capability | Status | User Role(s) | Route/Component | Notes |
|------------|--------|--------------|-----------------|-------|
| Auth (login, register, admin-login) | Working | All | `LoginPage`, `RegisterPage`, `AdminLoginPage` | — |
| Change password, change email | Working | All | `SettingsPage` | — |
| Create/edit lesson | Working | Teacher | `CreateLessonPage`, `EditLessonPage` | Full block set |
| AI lesson generation | Partial | Teacher | `TeacherDashboard` | Biology-first |
| Autopilot | Working | Admin/content_manager | `AutopilotApprovalPage`, etc. | — |
| Taxonomy | Working | Admin/content_manager | `AdminTaxonomyPage` | — |
| Topic banks (flashcards, quizzes, past papers) | Working | Teacher | `TeacherFlashcardBankPage`, etc. | — |
| Worksheets | Working | Teacher | `TeacherWorksheetBuilderPage` | — |
| Media uploads | Working | Teacher | `ImageUploader` | Supabase/R2/local |
| Lesson view (desktop/mobile) | Working | Student, Teacher | `LessonViewPage` | Sticky sidebars, mobile nav |
| Lesson reviews | Partial | Student | `LessonViewPage` | Only for Mongo ObjectId lessons; "coming soon" for Supabase |
| Admin lesson controls | Partial | Admin | `AdminLessonViewPage` | Some TODO |
| Student dashboard | Working | Student | `StudentDashboard` | — |
| Teacher dashboard | Working | Teacher | `TeacherDashboard` | — |
| Admin dashboard | Working | Admin/content_manager | `AdminDashboardPage` | — |

---

## 10. RECOMMENDED NEXT PRIORITIES

### A. Stable — leave alone now

- Auth (login, register, admin-login, password, email)
- Lesson creation and editing
- Media uploads (ImageUploader, assetUrl, mediaUrl)
- Topic banks (flashcards, quizzes, past papers)
- Worksheets
- Dashboards (teacher, admin)
- Lesson view (desktop sticky sidebars, mobile layout)
- Protected routes and role gates

### B. Fix before scaling content production

- **Lesson reviews:** Enable for Supabase/UUID lessons if desired (or document as Mongo-only for now)
- **AI generation:** Extend beyond Biology if needed
- **Admin lesson controls:** Complete isFreePreview and related if blocking content workflows

### C. Defer

- Major lesson editor UX overhaul
- New assessment types
- Parent dashboard enhancements
- Advanced admin analytics

### D. Top 5 highest-leverage next steps (content-first phase)

1. **Content production** — Use existing lesson editor, taxonomy, topic banks; create and publish lessons
2. **AI generation expansion** — Extend lesson-factory to Chemistry, Physics, Maths if needed
3. **Coverage sprint** — Use ContentCoveragePage, autopilot approval to fill gaps
4. **Lesson review rollout** — Decide on Supabase lesson reviews (or keep Mongo-only)
5. **Mobile polish** — Remove `?layoutDebug=1` if still present; verify real-phone flows

---

*Generated from codebase audit. Base on `last-working-state` tag.*
