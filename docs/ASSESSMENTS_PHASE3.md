# Assessments – Phase 3 Scope (UI + Attempts)

## Phase 3A – Paper Builder UI (Teacher/Admin)
Goal: Allow teachers/admins to visually create and manage AssessmentPapers.

Includes:
- Paper list page (filter by subject, exam board, published)
- Create/Edit paper form
- Add/remove AssessmentItems from paper
- Reorder items
- Set marksOverride per item
- Publish / unpublish paper

Excludes:
- Student attempt flow
- Analytics

## Phase 3B – Student Attempt Flow
Goal: Allow students to sit an AssessmentPaper like an exam.

Includes:
- Start paper
- Timer (timeSeconds)
- Question-by-question navigation
- Answer submission
- Deterministic marking (reuse existing marking logic)
- Results summary (score + breakdown)

Excludes:
- Adaptive logic
- AI marking
- Analytics dashboards

## Rules
- Reuse AssessmentItem + AssessmentPaper APIs
- No changes to Lesson revision features
- Additive models only (AssessmentAttempt later)
- Teacher/Admin UI hidden from students
