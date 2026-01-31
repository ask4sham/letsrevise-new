# Assessments – Phase 2 Scope (AssessmentPaper)

## Goal
Introduce AssessmentPaper as a container for AssessmentItems (Past Papers / Mock Exams / Practice Sets).

## Phase 2 Only
- New model: AssessmentPaper
- New routes: /api/assessment-papers
- No changes to Lesson schema
- No frontend UI work in this phase

## Permissions
- Admin/Teacher: create & edit (teachers can edit only papers they created; admin can edit any)
- Admin only: delete
- Students: view published papers only

## Paper Structure
- Metadata: title, subject, examBoard, level, kind (past_paper|mock_exam|practice_set), timeSeconds, tier
- Items: ordered list of AssessmentItem ids with order number and optional marksOverride/notes

## Out of Scope
- Sessions/attempts
- Timed exam UI
- Past paper PDF uploads
- AI generation
- Analytics
