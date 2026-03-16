# Auth / Access Audit

## Student-Only Endpoints

| Route | Protection |
|-------|------------|
| GET /api/student/dashboard | `isStudent(req)` |
| GET /api/student/topic-evidence | `isStudent(req)` |
| GET /api/student/my-work | `isStudent(req)` |
| GET /api/student/content/topic-flashcards | `isStudent(req)` |
| POST /api/progress/* | `isStudent(req)` |
| POST /api/practice-attempts | `isStudent(req)` |
| POST /api/practice-sets/generate | `isStudent(req)` |

## Teacher/Admin Endpoints

Teacher-only and admin-only routes use `requireTeacher`, `requireTeacherOrAdmin`, or route-level checks. No gaps identified for student content access.

## Outcome

Student content endpoints correctly restrict to students. Practice attempts validate StudentTeacherLink before accepting teacherId.
