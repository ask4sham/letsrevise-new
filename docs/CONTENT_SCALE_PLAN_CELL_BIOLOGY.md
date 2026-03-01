# Content scale plan: AQA GCSE Biology → Cell Biology

## Goals

- **Single source of truth** for lesson readiness (frontend evaluator from lesson payload only).
- **Page-aware quiz**: "Check your understanding" shows questions per page; untagged questions appear in "End of lesson test."
- **Content sprint** with clear Definition of Done (Minimum Publishable vs Classroom-Ready) and QA workflow.
- **Bank guardrails**: confirm topicKey before save; warn on duplicates.
- **PDFs** served reliably from `/docs/...` (static; no redirects).

---

## Definition of Done

### Minimum Publishable

- At least 1 page.
- At least 1 content block across all pages.
- At least 3 quiz questions.
- At least 10 flashcards.
- Topic set (topicKey or topic).
- Lesson marked as reviewed (reviewed flag / readiness.reviewed).

### Classroom-Ready

- All Minimum Publishable checks pass.
- At least 1 checkpoint.
- At least 1 misconception block.
- At least 1 diagram (or image-in-block heuristic).
- At least 10 practice questions attached **or** bank-exists flag (if present).

---

## Implementation checklist (PR-sized tasks)

| # | Task | Notes |
|---|------|--------|
| 1 | **Readiness evaluator** `frontend/src/utils/lessonReadiness.ts` | Counts + minimumPublishable + classroomReady from lesson only; no API calls. |
| 2 | **Readiness tests** `frontend/src/utils/lessonReadiness.test.ts` | Unit tests for evaluator. |
| 3 | **Wire Edit Lesson readiness UI** | Use evaluator for counts and status; "Mark as reviewed" aligns to reviewed flag. |
| 4 | **Definition of Done helper** | Two bullet lists under readiness box (min publishable + classroom-ready). |
| 5 | **Quiz question pageId** | Dropdown "Shown on page" in teacher quiz editor; persist with save. |
| 6 | **Student page-aware quiz** | LessonViewPage: per-page questions + "End of lesson test" for untagged. |
| 7 | **Validation warnings** | Quiz/flashcards editor: inline warnings (MCQ options, correctAnswer, flashcard front/back); "Fix issues" summary. |
| 8 | **Publish checklist panel** | Small panel: Topic, Quiz, Flashcards, Reviewed (✅/⚠️ from evaluator). |
| 9 | **Teacher docs index** | Links to PDF + TEACHER_TESTING_AND_PRACTICE_FLOW.md. |
| 10 | **Bank: topicKey confirm** | Modal before "Save to bank": topic, counts, preview; block if no topicKey. |
| 11 | **Bank: duplicate detection** | Hash normalized text; warn if duplicates (don't block). |
| 12 | **Past papers PDF** | Doc + helper text: PDFs in `frontend/public/docs/`, link to `/docs/...`. |

---

## QA workflow

### Automatic

- Readiness evaluator runs on lesson payload (no API).
- Inline validation warnings in quiz and flashcards editors (non-blocking).
- Publish checklist reflects evaluator checks.

### Human

- Teacher uses "Mark as reviewed" when content/quiz/flashcards are checked.
- Before publishing: confirm Topic, Quiz (≥3), Flashcards (≥10), Reviewed.
- Optional: run through Classroom mode once to confirm student view.

---

## Content sprint plan: AQA GCSE Biology → Cell Biology

**Baseline (per leaf topic):** 1 topicKey = **25 items** (10 MCQ + 5 short answer + 10 flashcards).

**Unit 1 — Cell Biology topic list** (from `docs/TAXONOMY_TOPIC_LIST.csv`; filter `specKey == "aqa-gcse-biology"`, `mainTopicTitle == "Cell Biology"`; taxonomy order):

| # | Topic (leaf) | topicSlug | topicKey | Status |
|---|--------------|-----------|----------|--------|
| 1 | Cell structure | cell-structure | `aqa-gcse-biology:cell-structure` | ✅ PR-SEED-1 |
| 2 | Animal and plant cells | animal-plant-cells | `aqa-gcse-biology:animal-plant-cells` | TODO |
| 3 | Eukaryotes and prokaryotes | eukaryotes-prokaryotes | `aqa-gcse-biology:eukaryotes-prokaryotes` | ✅ PR-SEED-2 |
| 4 | Cell specialisation | cell-specialisation | `aqa-gcse-biology:cell-specialisation` | TODO |
| 5 | Cell differentiation | cell-differentiation | `aqa-gcse-biology:cell-differentiation` | TODO |
| 6 | Microscopy | microscopy | `aqa-gcse-biology:microscopy` | TODO |
| 7 | Required Practical: Microscopy | rp-microscopy | `aqa-gcse-biology:rp-microscopy` | TODO |
| 8 | Cell Division | cell-division | `aqa-gcse-biology:cell-division` | TODO |
| 9 | Chromosomes | chromosomes | `aqa-gcse-biology:chromosomes` | TODO |
| 10 | Mitosis and the cell cycle | mitosis-cell-cycle | `aqa-gcse-biology:mitosis-cell-cycle` | TODO |
| 11 | Stem cells | stem-cells | `aqa-gcse-biology:stem-cells` | TODO |
| 12 | Transport in Cells | transport-in-cells | `aqa-gcse-biology:transport-in-cells` | TODO |
| 13 | Diffusion | diffusion | `aqa-gcse-biology:diffusion` | TODO |
| 14 | Factors that affect diffusion | factors-affect-diffusion | `aqa-gcse-biology:factors-affect-diffusion` | TODO |
| 15 | Osmosis | osmosis | `aqa-gcse-biology:osmosis` | TODO |
| 16 | Required Practical: Osmosis | rp-osmosis | `aqa-gcse-biology:rp-osmosis` | TODO |
| 17 | Active transport | active-transport | `aqa-gcse-biology:active-transport` | TODO |
| 18 | Diffusion in multicellular organisms | diffusion-multicellular | `aqa-gcse-biology:diffusion-multicellular` | TODO |
| 19 | Transport summary and applications | transport-summary | `aqa-gcse-biology:transport-summary` | TODO |
| 20 | Culturing microorganisms | culturing-microorganisms | `aqa-gcse-biology:culturing-microorganisms` | TODO |
| 21 | Required Practical: Growth | rp-growth | `aqa-gcse-biology:rp-growth` | TODO |

**Do not seed using un-namespaced slugs; always use topicKey `specKey:topicSlug`** (e.g. `aqa-gcse-biology:cell-structure`). This prevents seeding scripts from using the wrong identifiers.

**Counts (per lesson, target)**:

- **Pages**: 3–8 (one concept per page).
- **Content blocks**: text, key ideas, key words, exam tips, misconceptions, deeper knowledge.
- **Checkpoints**: ≥1 per lesson.
- **Diagrams**: ≥1 (cell structure, microscope, etc.).
- **Quiz questions**: ≥3 (page-aware where useful); **bank target**: 10 MCQ + 5 short answer per topicKey.
- **Flashcards**: ≥10 per topicKey.
- **Practice attached**: ≥10 (from bank or attach flow).

No code in this file—teacher/product friendly.
