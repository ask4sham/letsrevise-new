# EditLessonPage — Layout refactor notes (Phase 0)

## Current structure (before refactor)

- **Route/Page:** `frontend/src/pages/EditLessonPage.tsx` (teacher lesson editor).
- **Top area:** Back link, saveMsg, Publish/Unpublish, Save Changes.
- **Main layout:** 3-column grid (wide: 280px | 1fr | 360px; medium: 280px | 1fr; narrow: 1fr).
  - **Left rail:** Teacher guide (HowToCreateLessonCallout), Pages list (add/reorder/remove), Readiness card (evaluateLessonReadiness, Mark reviewed, Make classroom-ready), Practice questions card (Add from Question Bank, Auto-attach, list + remove).
  - **Center:** Lesson details card (title, exam board, subject, level, topic, duration, description), description, block editor, page-level tabs (Content, Key words, Exam insight, Checkpoint).
  - **Right (wide):** Preview column.
- **Full-width below grid:** "Revision Materials" section with:
  - "✨ Generate with AI" button.
  - Tabs: Flashcards, Quiz Questions, Quick Check, Past Papers.
  - Accordions: Flashcards (SS2/SS3), Quiz, Quick Check (optional), Past Papers — each with section-level generate/import actions and editors (FlashcardsEditor, quiz UI, AttachedAssessmentPapersPanel + Quick check generate, past papers list).
- **Modals:** AddFromBankModal (exam questions), AttachPaperModal (assessment papers).
- **State:** revisionTab, isFlashcardsCollapsed, isQuizzesCollapsed, isAssessmentsCollapsed, isPastPapersCollapsed; lesson, orderedPages, currentPageIndex; attachedExamQuestions, attachedPapersSummaries, assessmentQuestions; seed* loading/error/success for each section.

## Target structure (4 zones)

1. **Lesson setup** — Single card: Title, Spec/Subject/Exam board/Level, TopicKey, Duration, Description.
2. **Lesson content** — Pages list + block editor + live preview (main builder).
3. **Practice & assessment** — Exactly 3 cards: Practice questions, Practice papers, Quick check; student view summary strip at top.
4. **Teacher tools** (collapsed by default) — Flashcards, Quiz, Past papers (bulk generation / editors); role-gated diagnostics and admin.

## Components to reuse

- `AttachedAssessmentPapersPanel` — `frontend/src/components/lesson/AttachedAssessmentPapers.tsx`
- `AttachPaperModal` — `frontend/src/components/lesson/AttachPaperModal.tsx`
- `FlashcardsEditor` — `frontend/src/components/revision/FlashcardsEditor`
- `HowToCreateLessonCallout` — `frontend/src/components/teacher/HowToCreateLessonCallout`
- `SpecSelector` — used for topic/spec (resolveLessonTopicKeyFromLesson, topicKeyForBank).
- Add-from-bank modal and exam-questions API (existing).
