# Worked example — tagged “Vaccination” lesson (documentation only)

**Exam:** AQA GCSE Biology — **Infection and response** → **Vaccination**  
**Spec point (primary):** `AQA-BIO-IR-4.3.1.6` (see `docs/spec-maps/aqa-gcse-biology-infection-response.md`)  
**Purpose:** Realistic **blueprint** for how blocks could carry `specMeta`-style tags in future tooling — **no code**, **no schema**, **no UI**.

---

## 1. Lesson title

**Vaccination: protecting individuals and populations**

---

## 2. Lesson objective

By the end of this lesson, students can **explain how vaccination stimulates immunity**, use **correct scientific vocabulary** (antigen, antibody, memory cells, pathogen), and **evaluate evidence and claims** about vaccine programmes—including **herd immunity** and common **misconceptions** (e.g. MMR).

---

## 3. Example lesson flow

| Phase | What happens (learner experience) |
|-------|-----------------------------------|
| **Prior knowledge** | Quick recall: pathogens, white blood cells, first-line defences. |
| **Teaching** | Structured explanation: what a vaccine contains, why primary/secondary response differs, intro to herd immunity. |
| **Worked example** | Teacher models an “explain how vaccination works” paragraph using a simple scenario. |
| **Checkpoint** | MCQ + short follow-up on weakened pathogens vs memory cells. |
| **Drag / drop** | Match stages (e.g. primary response → memory cells → faster secondary response) or match term to definition. |
| **Sequence activity** | Order the logical steps from vaccine administration to protection on re-exposure. |
| **Quiz** | Mixed AO1 recall + AO2 application items; light AO3 on interpreting a simple chart (uptake %). |
| **Exam practice** | 6-mark-style: evaluate advantages and disadvantages of vaccination programmes in context. |

---

## 4. Block-by-block tagging (example)

**Lesson defaults (inherited, not repeated on every block):**  
`examBoard: AQA` · `subject: Biology` · `examLevel: GCSE`

**Legend — `activityRole`:** `retrieval` | `application` | `exam-practice` (designer-facing; not a formal schema field today).

| Order | Phase | Block type (example) | `specPoint` | AO | Command word | Marks | Difficulty | `activityRole` |
|------|--------|------------------------|-------------|-----|----------------|-------|------------|----------------|
| 1 | Prior knowledge | **Hook** / short text | `AQA-BIO-IR-4.3.1.1` | AO1 | state | — | low | retrieval |
| 2 | Prior knowledge | **Key idea** | `AQA-BIO-IR-4.3.1.5` | AO1 | outline | 2 | low | retrieval |
| 3 | Teaching | **Explanation** (what is a vaccine?) | `AQA-BIO-IR-4.3.1.6` | AO2 | explain | 4 | medium | application |
| 4 | Teaching | **Key idea** (weakened / dead / fragments) | `AQA-BIO-IR-4.3.1.6` | AO2 | describe | 3 | medium | application |
| 5 | Teaching | **Explanation** (memory cells & secondary response) | `AQA-BIO-IR-4.3.1.5` + `4.3.1.6` | AO2 | explain | 4 | medium | application |
| 6 | Teaching | **Explanation** (herd immunity — threshold idea) | `AQA-BIO-IR-4.3.1.6` | AO2 | explain | 4 | medium | application |
| 7 | Worked example | **Worked example** | `AQA-BIO-IR-4.3.1.6` | AO2 | explain | 6 | medium | application |
| 8 | Checkpoint | **Checkpoint** (MCQ: “What does a vaccine contain?”) | `AQA-BIO-IR-4.3.1.6` | AO1 | identify | 1 | low | retrieval |
| 9 | Checkpoint | **Checkpoint** (short: “Why can memory cells respond faster?”) | `AQA-BIO-IR-4.3.1.5` | AO2 | explain | 3 | medium | application |
| 10 | Drag / drop | **Drag-drop match** (term ↔ definition: antigen, antibody, memory cell, herd immunity) | `AQA-BIO-IR-4.3.1.6` (primary) | AO1 | match | 4 | low | retrieval |
| 11 | Sequence | **Interactive sequence** (order: vaccine → antigen recognised → antibodies produced → memory cells → faster response on re-exposure) | `AQA-BIO-IR-4.3.1.6` | AO2 | sequence | 4 | medium | application |
| 12 | Teaching | **Misconception** (MMR: “vaccine causes autism” claim — **evaluate evidence**) | `AQA-BIO-IR-4.3.1.6` | AO3 | evaluate | 6 | high | exam-practice |
| 13 | Quiz | **Quiz item** (MCQ: MMR protects against which diseases?) | `AQA-BIO-IR-4.3.1.6` | AO1 | state | 1 | low | retrieval |
| 14 | Quiz | **Quiz item** (application: “Suggest why booster campaigns are used”) | `AQA-BIO-IR-4.3.1.6` | AO2 | suggest | 3 | medium | application |
| 15 | Exam practice | **Exam-style** (extended: advantages/disadvantages of vaccination programmes + herd immunity) | `AQA-BIO-IR-4.3.1.6` | AO3 | evaluate | 9 | high | exam-practice |

**Notes on multi-spec blocks (row 5):** In a real implementation you might store **one primary** `specPoint` plus `secondarySpecPoints: []` or keep a single point and mention the other in teacher notes only — **decide at schema time**; this doc shows intent.

---

## 5. How different activity types map differently

| Activity type | Typical AO lean | Typical command words | Marks | `activityRole` | Why it differs |
|---------------|-----------------|------------------------|-------|------------------|----------------|
| **Checkpoint** | AO1 → AO2 | identify, explain, give | Low–medium marks per item | retrieval / application | **Fast signal** of understanding; often single-concept. |
| **Drag / drop** | Mostly AO1 (sometimes AO2 if scenario board) | match, classify | Low marks; many “micro” marks possible | retrieval (default) | **Pattern recognition**; less extended writing. |
| **Interactive sequence** | AO2 (process order) | order, sequence, arrange | Medium | application | **Procedural** understanding; good for pathways (immune response). |
| **Worked example** | AO2 (modelled) | explain, describe | Medium–high | application | **Cognitive apprenticeship**; marks reflect expected student output when copied/adapted. |
| **Exam practice** | AO3 (plus AO2 stems) | evaluate, discuss, assess | High | exam-practice | **Extended reasoning**, evidence, **balance** (advantages/disadvantages). |

**Design principle:** Same **spec point** (`4.3.1.6`) can appear across types; **AO and marks** shift with **demand** of the task, not with the widget alone.

---

## 6. Worked content examples (vocabulary & misconceptions)

Use these as **internal authoring notes**; tags above already reference them.

| Concept | Student-facing angle | Suggested AO / type |
|---------|----------------------|---------------------|
| **Herd immunity** | High uptake reduces transmission so vulnerable people are indirectly protected. | AO2 explain in teaching; AO3 evaluate in exam item (limitations: not everyone can be vaccinated). |
| **Memory cells** | Remain after infection/vaccination → **faster, stronger secondary response** on re-exposure. | AO2 explain (checkpoint / sequence). |
| **Weakened / inactivated pathogens / fragments** | Vaccine stimulates immune response **without causing disease** (typical exam contrast). | AO1/AO2 depending on depth (define vs explain). |
| **Advantages / disadvantages** | Advantages: control epidemics, protect individuals, cost-effective at scale. Disadvantages: mild side effects, rare allergies, need cold chain/logistics, uptake needed for herd immunity. | AO3 evaluate in exam practice. |
| **MMR misconceptions** | MMR example: **three diseases**; address false causal claims using **evidence from large studies** (AO3); keep tone factual and safeguarding-aware in classroom copy. | AO3 + citizenship/safeguarding in teacher notes (not a tag field). |

---

## 7. How this could power adaptive revision later

1. **Weak-AO detection:** If quizzes tagged **AO3** under `4.3.1.6` score poorly, revision sessions **over-weight** AO3 prompts (evaluate, discuss) while still drilling AO1 fluency (terms).  
2. **Spec-point coverage:** Dashboard shows **which of 4.3.1.x** sub-ideas were practised vs only “seen” in teaching blocks.  
3. **Difficulty + spacing:** **High difficulty / high marks** items resurface with **shorter intervals** until performance improves (simple SRS rule).  
4. **Misconception pack:** Items tagged with **misconception** content (e.g. MMR) can be bundled into a **short targeted loop** after the main vaccination deck.  
5. **Command-word coaching:** Analytics on **“explain” vs “evaluate”** success guide the next homework generator to pick **command words** the class underuses.

---

*Worked tagging example — documentation only — Vaccination lesson, AQA GCSE Biology.*
