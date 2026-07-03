# Teacher Experience Vision

**Status:** Product reference — living document  
**Last updated:** 2026-06-16  
**Audience:** Product, engineering, design  

Use this document when proposing features. Ask: **Does this support the Teacher Experience Vision, or does it complicate it?**

---

## 1. The product shift

### Where we started

```
Teacher → Create Lesson → Publish → Student
```

LetsRevise began as an **AI lesson generator**.

### Where we are now

```
Teacher
   │
Create Lesson
   │
Submit for Approval
   │
──────────────────────────
 Admin Teacher Library
──────────────────────────
Pending → Approve / Reject / Retire
   │
   ▼
LetsRevise Approved
   │
   ▼
Teacher Catalogue
   │
Preview · Teach
   │
Students
```

LetsRevise is now a **moderated educational platform**.

### The emotional goal

When a teacher logs in, they should feel:

> **"I can start teaching in under a minute."**

Not:

> **"I have to create something."**

That shift — from authoring tool to teaching platform — is the core product direction.

---

## 2. Three lanes (never merge)

Three distinct concepts serve different purposes. They must stay separate in UI, API, and mental model.

| Lane | Mechanism | Purpose | Draft OK? |
|------|-----------|---------|-----------|
| **Review Requests** | `LessonShare` VIEW → `SHARED_REVIEW` | Private quality assurance between colleagues | Yes |
| **Shared with Me** | `LessonShare` TEACH → `SHARED_TEACH` | Private classroom teaching (named invite) | Yes |
| **Approved Lessons** | `teacherLibrary.approved` + published | LetsRevise Approved commercial catalogue | No |

**Do not merge** LessonShare collaboration with catalogue discovery.

---

## 3. Core workflows

### 3.1 Create & publish (owner)

- Teacher creates and edits in **My Lessons** (creator workspace).
- Owner publishes when ready for students.
- Publishing and catalogue approval are **related but distinct**:
  - **Published** → students may access (entitlement rules apply).
  - **LetsRevise Approved** → appears in the teacher catalogue for all subscribed teachers.

### 3.2 Catalogue approval (platform moderation)

```
Draft / Published
      │
Owner: Submit for Approval
      │
teacherLibrary.status = pending_review
      │
Admin Teacher Library: Approve | Reject | Retire
      │
approved (requires re-approval after substantive edit — Option A)
```

**Rules:**

- Catalogue listing requires **published AND approved**.
- Editing an approved lesson returns it to **pending_review** (moderation before catalogue re-listing).
- Rejection notes are visible to the owner.
- Audit trail lives in `LessonApproval`; lightweight state on `Lesson.teacherLibrary`.

### 3.3 Peer review (collaboration)

- Owner shares with named teachers: **Review only** or **Teach in classroom**.
- Reviewers see **Review Requests**; TEACH shares appear under **Shared with Me**.
- Rachel-style testing: shared access works **without subscription** and **including drafts**.

### 3.4 Teach from catalogue (discovery)

- Any subscribed teacher browses **Approved Lessons**.
- **Preview** — evaluate before teaching (no subscription gate in V1 backend).
- **Open Classroom** — teach the master lesson (subscription gate planned at this single point only).

---

## 4. Navigation & naming

### Teacher-facing labels (locked)

| Use | Avoid |
|-----|--------|
| **Teacher Dashboard** | Teacher Home |
| **My Lessons** | Old “Teacher Dashboard” as creator label |
| **LetsRevise Approved** (badge) | Curated Teacher Library |
| **Approved Lessons** / **Browse Lessons** | Internal “catalogue” jargon in UI |
| **Shared with Me** | Teaching Library (user-facing) |
| **Open Classroom** | Start Teaching |
| **Review Requests** | — |

### Planned top-level nav

```
Dashboard          →  “What am I teaching today?”
Lessons            →  Approved catalogue + shortcuts
My Lessons         →  Owner workspace (create, edit, publish)
New Lesson
Question Bank
Past Papers
```

---

## 5. Teacher Dashboard vision (landing)

The default login landing answers **“What am I teaching today?”** — not **“What have I created?”**

### Hero

Search dominates. Everything else is secondary.

```
What are you teaching today?
[ Search Biology, Photosynthesis, Respiration... ]
```

### Section order

1. **Continue Teaching** — resume yesterday’s lesson in one click  
2. **Approved Lessons** — LetsRevise Approved showcase  
3. **My Drafts** — shortcut to creator workspace  
4. **Shared with Me** — private TEACH invites  
5. **Review Requests** — peer QA  

### Approved lesson card

- Title, subject, board, level, topic  
- **LetsRevise Approved** badge  
- Version / updated date (from `teacherLibrary.version`)  
- Later: teacher rating, usage stats  
- Actions: **Preview** · **Open Classroom**

---

## 6. Admin Teacher Library

Admin-only moderation console (`/admin/teacher-library`).

**Tabs:** Pending Review · Approved · Rejected · Retired  

**Actions:** Preview · Approve · Reject · Retire  

This makes the approval backend **operable** before exposing the catalogue to all teachers.

---

## 7. Backend freeze (this area)

As of `teacher-library-admin-v1`, the following backend capabilities are **complete for V1**:

| Capability | Milestone |
|------------|-----------|
| Share for review (VIEW) | `share-lesson-for-review-v1` |
| Teaching access (TEACH) | `teaching-access-v1` |
| Approval workflow + catalogue API | `approved-lessons-v1` |
| Admin moderation API + UI | `teacher-library-admin-v1` |
| Access reasons: `SHARED_*`, `APPROVED_*` | `approved-lessons-v1` |

**Do not add backend features in this area** until the teacher experience milestones below are delivered.

Future backend (later phases only):

- Subscription gate on `APPROVED_TEACH` (single choke point)
- Teacher ratings collection
- Usage analytics / creator stats
- Marketplace / royalties (much later)

---

## 8. Roadmap from here (experience-first)

All remaining work in this product area is **teacher experience**, not infrastructure.

| Phase | Milestone | Scope |
|-------|-----------|-------|
| **1** | `teacher-dashboard-v2-shell` | New landing behind `REACT_APP_TEACHER_DASHBOARD_V2`. **No new business logic.** Links to existing pages. |
| **2** | `approved-lessons-catalogue-ui` | Search, filters, Preview, Open Classroom wired to real API |
| **3** | Subscription gating | **One gate only:** Open Classroom on approved catalogue |
| **4** | Teacher ratings | ★★★★★ + review count on cards |
| **5** | Usage analytics | Creator motivation on My Lessons (teachers using, students reached) |

### Explicitly not building yet

- Marketplace payments  
- Royalties / revenue sharing  
- School organisations  
- Copy lesson (V1 teaches from master)  

---

## 9. Subscription philosophy

**One clean gate. Don't annoy teachers everywhere.**

| Access | Subscription required? |
|--------|------------------------|
| Owner / My Lessons | No |
| Review Requests (preview) | No |
| Shared with Me (classroom) | No — explicit share bypass |
| Approved Preview | No (evaluate before subscribing) |
| **Approved Open Classroom** | **Yes** |

---

## 10. Creator motivation (future — Phase 5)

Imagine Sham opening My Lessons:

```
Human Reproductive Systems
Approved · Version 2.3

Teachers using     147
Students reached   5,182
★★★★★ 4.9
```

Stats live in separate collections (`LessonCatalogueStats`, etc.) — not bloated onto `Lesson`.

---

## 11. Milestone history (shipped)

Each milestone: **isolated · tested · tagged · deployable**.

| Tag | What it delivered |
|-----|-------------------|
| `edexcel-platform-v1` | Edexcel taxonomy / platform foundation |
| `fix-lesson-preview-no-visual-explanation-card-v1` | Preview quality fix |
| `share-lesson-for-review-v1` | Peer review lane (VIEW shares) |
| `teaching-access-v1` | Private teach lane (TEACH shares) |
| `approved-lessons-v1` | Catalogue approval backend + access rules |
| `teacher-library-admin-v1` | Admin moderation console |

---

## 12. Decision checklist

Before adding a feature in the teacher/lesson/catalogue space, ask:

1. **Which lane?** Review · Shared · Approved — or owner workspace?  
2. **Does it help a teacher start teaching in under a minute?**  
3. **Does it merge lanes we explicitly separated?**  
4. **Does it require new backend, or can it ship as UI on existing APIs?**  
5. **Does it add subscription friction beyond Open Classroom?** (Avoid.)  
6. **Does it belong in marketplace/royalties?** (Defer.)  

If the answer complicates lanes, splits teacher attention, or expands backend scope before the dashboard shell ships — **defer or redesign**.

---

## 13. Next milestone

**`teacher-dashboard-v2-shell`**

- Feature flag: `REACT_APP_TEACHER_DASHBOARD_V2=true` (default OFF)  
- Beautiful landing, hero search UI, section placeholders  
- Every button links to **existing** pages  
- **Zero new business logic**  
- My Lessons moves to `/teacher/my-lessons` (route rename only; same page)  

After the shell feels right → wire approved catalogue UI.

---

*This document describes product philosophy, not implementation. For API details see backend tests and milestone tags.*
