# Phase 3H.1.7 — Teacher Brain Teaching Quality Rubric

**Branch:** `phase-3h1-teacher-first-knowledge`  
**Status:** Implemented (score / diagnose / guide — no mutation)  
**Flag:** `TEACHER_BRAIN_TEACHING_QUALITY=1` (default OFF)

## Rubric (0–40)

Eight dimensions, each scored **0–5**:

| Dimension | Label |
|-----------|--------|
| coreConceptClarity | Core Concept Clarity |
| misconceptionHandling | Misconception Handling |
| examinerGuidance | Examiner Guidance |
| workedReasoning | Worked Reasoning |
| retrievalPractice | Retrieval Practice |
| compareContrast | Compare & Contrast |
| grade79Extension | Grade 7–9 Extension |
| memoryRule | Memory Rule |

## Coverage Review

`buildLessonCoverageReview` returns `teachingQualityReview` with:

- `scoreLabel` (e.g. `26/40`)
- `strengths`, `weaknesses`, `missing`, `present`

## Prompt appendix

`formatTeachingQualityAppendix` injects **TEACHING QUALITY REQUIREMENTS** for supported Biology profiles (Homeostasis, Nervous System structure, The Eye).

## Files

- `lib/teacherBrain/teachingQualityRubric.js`
- `tests/teachingQualityRubric.test.js`
- `tests/teachingQualityIntegration.test.js`
- `backend/scripts/manualAcceptance3H17.js`

---

## Problem

Generated lessons often **define, describe, and exemplify** but inconsistently:

- expose misconceptions
- compare similar concepts
- explain examiner traps
- use retrieval before explanation
- model worked reasoning
- build exam language automatically

Manual review still feels like *“an AI summarised the topic”* rather than *“a strong GCSE teacher taught this lesson.”*

Phase 3H.1 fixed **opening order**. Phase 3H.1.7 fixes **Core Teaching quality** and adds a **save-time rubric gate**.

---

## Goal

Every generated lesson must satisfy **eight mandatory teaching-quality criteria** before it can be saved (when the rubric flag is on).

| # | Criterion | Student-facing label |
|---|-----------|----------------------|
| 1 | Misconception exposure | **What students often get wrong** |
| 2 | Examiner guidance | **Examiner tip** |
| 3 | Concept discrimination | **Compare and contrast** |
| 4 | Reasoning model | **Worked reasoning example** |
| 5 | Retrieval before teaching | **Retrieval checkpoint** |
| 6 | Top-band modelling | **Grade 9 explanation** |
| 7 | Durable recall | **Memory rule** |
| 8 | Outcome clarity | **Success metric** |

**North star:** A teacher reviewing the lesson should hear a confident GCSE voice — not a textbook summary.

---

## Scope

### In scope

- Rubric definition (criteria, detection rules, pass thresholds)
- Canonical **Core Teaching** section template (block 9 in teacher-first order)
- Save-time validation hook design (`generate-and-save`, SS1 path)
- Prompt appendix design for generation + second-pass rewrite
- Manual acceptance script spec

### Out of scope (later phases)

- Block-order changes (3H.1 is locked)
- Publish gate changes for manually edited lessons (rubric applies to **AI generation save** first)
- Subject profiles beyond Biology (generic rubric first; profiles extend detection)

---

## Feature flag

```
TEACHER_BRAIN_TEACHING_QUALITY_RUBRIC=1
```

When off: existing `scoreLessonQuality` + structure validation only (current behaviour).  
When on: **`evaluateTeachingQualityRubric`** must pass before draft save.

Recommended acceptance bundle (with teacher-first):

```
TEACHER_BRAIN_TEACHER_FIRST_OPENING=1
TEACHER_BRAIN_TEACHING_QUALITY_RUBRIC=1
TEACHER_BRAIN_PEDAGOGY_ENGINE=1
TEACHER_BRAIN_GCSE_REASONING_ENGINE=1
```

---

## Canonical Core Teaching template (block 9)

Core Teaching is a **single `text` block** (`role: "concept"`) containing **ordered `<h2>` sections**. Extra teaching beats may follow as additional text blocks **only after** block 9 (existing SS1 rule).

Required section headings (exact HTML patterns for generation; fuzzy match for validation):

```html
<h2><strong>🔄 Retrieval checkpoint</strong></h2>
<p>[One short question BEFORE new explanation — no answer revealed yet, or reveal after one sentence of setup.]</p>

<h2><strong>❌ What students often get wrong</strong></h2>
<p><strong>Wrong:</strong> …</p>
<p><strong>Correct:</strong> …</p>
<p><strong>Exam link:</strong> …</p>

<h2><strong>⚖️ Compare and contrast</strong></h2>
<p>[Two confusable ideas — table or “X whereas Y” — topic-specific.]</p>

<h2><strong>🧠 Worked reasoning example</strong></h2>
<p><strong>Question:</strong> … (n marks)</p>
<ol><li>[Reasoning step 1]</li><li>[Step 2]</li><li>[Step 3 → marking point]</li></ol>

<h2><strong>🏆 Grade 9 explanation</strong></h2>
<p>[Top-band phrasing: precise terminology, causal chain, exam command-word language.]</p>

<h2><strong>🎯 Examiner tip</strong></h2>
<p>[One concrete mark-earning rule for this sub-topic.]</p>

<h2><strong>✅ Success metric</strong></h2>
<ul>
  <li>You can explain …</li>
  <li>You can compare …</li>
  <li>You avoid the misconception …</li>
</ul>
```

**Memory rule** remains at **Final memory rule** (`keyIdea`, `role: "finalMemoryRule"`) — block 17 in teacher-first SS1 — with `💡 Key Insight` heading (existing non-negotiable). Rubric criterion 7 validates that block, not a duplicate inside Core Teaching.

---

## Rubric criteria — detection rules

Implementation lives in `lib/teacherBrain/teachingQualityRubric.js`. Each criterion returns `{ id, passed, score, evidence, fixHint }`.

### 1. What students often get wrong (`misconception`)

**Pass if** any of:

- Core Teaching contains heading matching `/what students often get wrong|common mistake|students often/i` **and** body has `Wrong:` + `Correct:` + `Exam link:` (or `<strong>Wrong:</strong>` variants)
- A `commonMistake` block within **3 blocks after Core Teaching** uses the three-line Wrong/Correct/Exam link format
- Existing `commonMistake` role block anywhere with valid three-line format **and** topic-specific tokens (not generic filler)

**Fail signals:** generic “read the question carefully”; missing wrong/correct pair; definition restated as “mistake”.

### 2. Examiner tip (`examinerTip`)

**Pass if** any of:

- Core Teaching `🎯 Examiner tip` section ≥ 40 chars, mentions marks/command word/timing/wording
- An `examTip` block passes existing `examTipLooksSpecific(block, lesson)`
- Exam tip block contains `Premium Exam Tip` or `Think like an examiner` with topic tokens

**Fail signals:** repeats definition; “revise this topic”; no mark-earning instruction.

### 3. Compare and contrast (`compareContrast`)

**Pass if** any of:

- Core Teaching `Compare and contrast` section passes `blockMentionsComparison(text)` **and** names two distinct entities from topic
- `patternRecognition` keyIdea block with comparison language
- GCSE reasoning chain includes contrast step (`whereas`, `unlike`, `difference between`)

**Fail signals:** single concept described; “compare” without two sides.

### 4. Worked reasoning example (`workedReasoning`)

**Pass if** any of:

- Core Teaching section with ordered steps (`<ol>` or numbered lines) tied to a question with mark count
- Checkpoint `role: "workedExample"` with question + answer/explanation > 80 chars and ≥ 2 reasoning steps (not bullet dump only)
- GCSE reasoning engine reports ≥ 4/5 steps present across Core Teaching + workedExample checkpoint

**Distinction from existing workedExample rule:** must show **reasoning chain** (because/therefore/so that), not only marking-point bullets.

### 5. Retrieval checkpoint (`retrievalCheckpoint`)

**Pass if**:

- Core Teaching opens with retrieval section **before** misconception/compare sections
- **OR** a `checkpoint` block **before** Core Teaching index (teacher-first block 9) with a question stem and no full model answer in the same block
- Question uses recall/command stem (State/Name/What/Which) or “Before we go further…” framing

**Pedagogy rule:** retrieval must appear **before** the main new explanation in Core Teaching (section order enforced in template).

### 6. Grade 9 explanation (`grade9Explanation`)

**Pass if** any of:

- Core Teaching `Grade 9` section with ≥ 2 sentences linking structure → function → exam application
- `stretch` block with “Grade 9” / “top band” / “full marks” language and topic-specific causal chain
- Exam tip block contains `Full-mark answer:` with ≥ 3 distinct marking ideas (existing SS1 non-negotiable contributes here)

**Fail signals:** “write more”; extra adjectives without science; repeats Core model verbatim.

### 7. Memory rule (`memoryRule`)

**Pass if**:

- Exactly one block with `role: "finalMemoryRule"` (existing structure rule)
- Content includes `💡 Key Insight` or passes `finalMemoryRuleLooksSpecific`
- 1–3 memorable lines; topic-specific tokens present

*(Validates lesson-level closure; not duplicated inside Core Teaching.)*

### 8. Success metric (`successMetric`)

**Pass if**:

- Core Teaching `Success metric` section with ≥ 2 bullet outcomes using **you-can** phrasing (`you can explain`, `you can compare`, `you can identify`)
- Bullets reference topic vocabulary or the stated misconception

**Fail signals:** “you will understand the topic”; objectives copied from block 1.

---

## Scoring and save gate

### Per-criterion scoring

Each criterion: **0** (missing) or **1** (present and quality-checked).  
Optional quality sub-score 0–100 for diagnostics (feeds second-pass hints).

### Lesson rubric score

```
teachingQualityScorePct = round(passedCriteria / 8 * 100)
```

### Save gate (AI generation only, flag on)

| Result | Action |
|--------|--------|
| 8/8 criteria pass | Allow save |
| 6–7/8 | Trigger **teaching-quality second pass** (rewrite Core Teaching + targeted blocks); retry once |
| ≤5/8 after retry | **Block save** with `teachingQualityRubric` issues array |
| Flag off | No rubric gate (legacy) |

**Mandatory blockers** (never soft-fail): `misconception`, `workedReasoning`, `retrievalCheckpoint`, `memoryRule`.

### Relationship to `scoreLessonQuality`

| System | Role |
|--------|------|
| `validateLessonStructure` | Block types, roles, SS1 order — unchanged |
| `scoreLessonQuality` | Holistic 0–100 publish band — unchanged |
| `evaluateTeachingQualityRubric` | **New** binary teaching checklist for Core Teaching voice |

Rubric failure can block save even when quality score ≥ 70.  
Rubric pass does **not** bypass structure validation.

---

## Integration points

### 1. Prompt generation

Append `buildTeachingQualityRubricPromptSection()` when flag on:

- SS1: `lib/buildPrompt.js` → after Core Teaching template in `buildSs1FirstBlocksTemplateSection`
- Dashboard: `lib/teacherBrain/dashboardTeacherFirstOpening.js` → extend Core Teaching contract in `buildDashboardTeacherFirstPromptSection`

### 2. Post-generation enforcement

Optional deterministic enricher (3H.1.7c): insert missing section stubs from topic profile — **not in initial rubric PR**.

### 3. Save path

`backend/routes/ai.js` → `generate-and-save`:

```
after enforceDashboardTeacherFirstOpening / final sanitize
→ rubric = evaluateTeachingQualityRubric(finalDraft)
→ if !rubric.passed && flag on → second pass OR 400
→ attach metadata: lesson.metadata.teachingQualityRubric = rubric
```

SS1 path: same check in `deterministicAutoFixLesson` pipeline before return.

### 4. Second-pass rewrite

New improver section: feed `rubric.failedCriteria` + `fixHint` per criterion into existing `improveDraftWithSecondPass` (same pattern as structure/quality issues).

### 5. Coverage review

Extend `lib/teacherBrain/lessonCoverageReview.js` with `teachingQualityCoverage` summary for acceptance scripts.

---

## Acceptance criteria (manual)

Script: `backend/scripts/manualAcceptance3H17.js` (to be created in implementation).

For each topic: **Homeostasis**, **Nervous system structure**, **The eye**:

| Check | Pass |
|-------|------|
| Core Teaching block index | 9 (teacher-first) |
| All 8 rubric criteria | `passed: true` |
| `teachingQualityScorePct` | 100 |
| Retrieval before misconception in Core Teaching HTML | section order |
| Manual voice check | reviewer marks “teacher-like” |

Report JSON: `{ topic, criteria: {...}, teachingQualityScorePct, pass }`.

---

## Implementation sequence

| Step | Deliverable |
|------|-------------|
| **3H.1.7a** (this doc) | Rubric design + `teachingQualityRubric.js` spec |
| **3H.1.7b** | Detection functions + unit tests |
| **3H.1.7c** | Prompt appendix (SS1 + Dashboard) |
| **3H.1.7d** | Save gate + second-pass wiring |
| **3H.1.7e** | Manual acceptance + integration test |

---

## Example — pass excerpt (Core Teaching)

> **🔄 Retrieval checkpoint** — Before reading on: what is the role of receptors in a reflex arc?  
> **❌ What students often get wrong** — Wrong: the brain always controls reflexes. Correct: reflexes bypass the brain via the spinal cord. Exam link: “explain reflex” questions require the pathway, not brain processing.  
> **⚖️ Compare and contrast** — Sensory neurones carry impulses **to** the CNS; motor neurones carry impulses **away** to effectors.  
> **🧠 Worked reasoning example** — Question: Explain how a reflex arc produces a rapid response (4 marks). Steps: stimulus → receptor → sensory neurone → relay neurone → motor neurone → effector → rapid response without conscious thought.  
> **🏆 Grade 9 explanation** — …  
> **🎯 Examiner tip** — Credit “relay neurone in spinal cord” not “brain decides”.  
> **✅ Success metric** — You can explain the pathway; you can compare sensory vs motor neurones; you avoid saying the brain controls reflexes.

---

## Example — fail patterns

| Pattern | Failed criteria |
|---------|-----------------|
| Core Teaching is one paragraph defining terms | All 8 |
| Misconception in block 14 but Core Teaching is definition-only | retrieval, compare, grade9, success |
| Worked example bullets with no “because/therefore” | workedReasoning |
| “Grade 9: write in more detail” | grade9Explanation |
| Objectives repeated as success metric | successMetric |

---

## Files (planned)

| File | Purpose |
|------|---------|
| `lib/teacherBrain/teachingQualityRubric.js` | Criteria registry + evaluator |
| `tests/teachingQualityRubric.test.js` | Unit tests with fixture lessons |
| `backend/tests/aiGenerateTeachingQuality.integration.test.js` | Mocked generate-and-save gate |
| `backend/scripts/manualAcceptance3H17.js` | Live acceptance |
| `docs/milestones/PHASE_3H1_7_TEACHING_QUALITY_RUBRIC.md` | This document |
