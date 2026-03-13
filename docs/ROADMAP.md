# LetsRevise — Product Roadmap (CTO Execution Plan)

This roadmap is the **single source of truth** for how we ship the next sellable version fast, without breaking guardrails (taxonomy, namespacing, CI validation, copyright safety).

---

## Principles (non-negotiable)

- **No copyrighted ingestion**  
  We do not preload, scrape, or redistribute exam-board materials.

- **Teacher-uploaded resources only**  
  PDFs/media require explicit confirmation of rights (`confirmCopyright` hard gate).

- **Namespaced topic keys only**  
  All stored topic keys use `specKey:topicKey`. Reads use candidate lookup.

- **One canonical spec pattern**  
  taxonomy JSON → taxonomy API route → tests → SpecSelector → validator pass.

- **Validator + CI are mandatory**  
  `npm run validate:taxonomies` must pass for every PR.

---

# CTO-Ordered PR List (Fastest path to revenue)

---

## PR-PAST-PAPERS-UI-3 — Attach from bank ✅ DONE

**Goal:** Make past papers usable at scale by attaching teacher-authored exam questions.

**Status:** Implemented, tested, merged.

---

## PR-ADMIN-INGEST-UI-1 — Admin ingestion UI (CSV → Preview → Import)

**Goal:** Remove engineer-only ingestion. Enable a one-person team to scale content safely.

### Scope
- Admin/teacher UI to:
  - Upload CSV
  - Choose target type:
    - Flashcards
    - Exam Questions
    - Past Papers
    - Past Paper Questions
  - Select specKey (defaults to SpecSelector)
  - Preview parsed rows with:
    - validation errors
    - dedupe predictions
    - would_insert vs skip_duplicate
  - Import valid rows using existing bulk-import APIs
- No new ingestion logic that bypasses guardrails

### Acceptance criteria
- CSV preview shows row-level errors clearly
- Import cannot proceed with:
  - unknown specKey
  - invalid topicKey
- Import results are shown and downloadable as JSON
- Past paper PDFs remain teacher-uploaded only

### Test plan
- Manual UI flow
- Existing backend bulk-import tests reused
- Optional: one frontend smoke test

### Complexity
- **L**

---

## PR-PRACTICE-LOOP-1 — Student practice + tracking (MVP retention loop)

**Goal:** Turn content banks into a product students use repeatedly.

### Scope
- Student practice sets by:
  - Spec → Collection → Topic
- Pull questions from:
  - ExamQuestion
  - PastPaperQuestion (teacher-authored only)
- Student self-mark + confidence
- Attempt tracking:
  - studentId, specKey, topicKey, questionId, outcome, timestamp
- Teacher dashboard:
  - attempts per topic
  - accuracy trend

### Acceptance criteria
- Students can complete a practice set
- Attempts persist and aggregate correctly
- Teachers can see topic-level performance
- No copyrighted material exposed

### Test plan
- Backend integration: create attempt, fetch stats
- Manual end-to-end practice run

### Complexity
- **L**

---

## PR-METADATA-1 — Difficulty & skill tagging

**Goal:** Improve question quality, filtering, and future AI generation.

### Scope
- Optional metadata:
  - `difficulty` (1–5)
  - `skill` (`recall`, `application`, `analysis`, `exam-technique`)
- Accepted via:
  - bulk import
  - manual add flows
- Filters in:
  - Exam Question Bank
  - Past Paper Questions
  - Practice generator

### Acceptance criteria
- Tags saved and filterable
- Invalid values rejected
- Existing content unaffected

### Test plan
- Backend validation tests
- Manual UI filtering

### Complexity
- **M**

---

## Expansion phase — OCR / Edexcel / WJEC

**Workflow (mandatory):**
1. taxonomy JSON
2. taxonomy API route
3. integration test
4. SpecSelector entry
5. validator pass

**Complexity:** **S per spec**

---

## Universal PR Checklist

- [ ] `npm test` passes
- [ ] `npm run validate:taxonomies` passes
- [ ] No "download past papers" wording
- [ ] All topic keys namespaced
- [ ] No copyrighted ingestion

---

## Current status

- PR-PAST-PAPERS-UI-3 ✅ DONE
- PR-ADMIN-INGEST-UI-1 ⏭ NEXT
- PR-PRACTICE-LOOP-1 ⏳
- PR-METADATA-1 ⏳

This document is authoritative. If it's not here, we don't build it.
