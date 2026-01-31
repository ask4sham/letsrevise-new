# Unified Assessment Item Algorithm (LetsRevise)

Design for a single assessment pipeline that supports multiple question types while reusing the existing `AssessmentItem`, `AssessmentAttempt.answers[]`, and deterministic marking. No LLM at runtime; short answers keep fuzzy logic with negation awareness; diagram and table questions mark per sub-part and sum marks.

---

## 1. Separation: Content vs Mark Scheme vs Student Answer

| Layer | Purpose | Stored on | Used at |
|-------|---------|-----------|---------|
| **Content** | Question stem, image, options, table structure, diagram image + regions | `AssessmentItem` (question, options, `content.*`) | Display only |
| **Mark scheme** | Correct answers, acceptable variants, marks per part, marking rules | `AssessmentItem` (`markScheme`, `correctAnswer`, type-specific keys) | Marking only |
| **Student answer** | What the student submitted | `AssessmentAttempt.answers[]` | Marking input |

- **Content** is never used to decide correctness; only to render the question.
- **Mark scheme** is the single source of truth for marking (deterministic).
- **Student answer** is the only input to the marking function; no LLM, no live lookup.

---

## 2. AssessmentItem Schema Extensions

Reuse the existing schema. Add/change:

- **`type`**  
  Extend enum to: `"mcq"` | `"short"` | `"label"` | `"table"` | `"data"`  
  (Map existing `"multiple-choice"` → `"mcq"`, `"short-answer"` → `"short"` for compatibility.)

- **`marks`**  
  Keep as total marks for the item. For multi-part (label, table, data), total = sum of part marks.

- **`correctAnswer`**  
  Type-specific shape (see below). Remains `Mixed`.

- **`markScheme`**  
  Optional array of strings for GCSE-style “mark scheme text” (display/export only; marking uses structured data in `correctAnswer` / type-specific fields).

- **`content`**  
  Optional object for type-specific content (image URL, region definitions, table headers, graph description) so content is clearly separate from mark scheme.

### 2.1 Type: `mcq` (Multiple choice, single correct)

- **Content:** `question`, `options` (array of strings).
- **Mark scheme:** Correct option identified by value or index.

```json
{
  "type": "mcq",
  "question": "What is the main product of photosynthesis?",
  "options": ["Glucose", "Protein", "Starch", "Lipid"],
  "correctAnswer": "Glucose",
  "marks": 1,
  "markScheme": ["Allow: glucose / sugar (1)"]
}
```

Alternative: `correctAnswer` as number (index), e.g. `0` for first option. Backend already supports both via `options.findIndex(opt => opt === correctAnswer)` or `correctIndex`.

---

### 2.2 Type: `short` (Short answer, auto-marked, fuzzy, 1–2 marks)

- **Content:** `question`.
- **Mark scheme:** Model answer(s), optional list of acceptable variants, mark allocation. Negation awareness lives in the marking algorithm (existing logic).

```json
{
  "type": "short",
  "question": "Describe the difference between eukaryotic and prokaryotic cells in terms of the nucleus.",
  "correctAnswer": "Eukaryotic cells have a nucleus; prokaryotic cells do not have a nucleus.",
  "marks": 2,
  "markScheme": [
    "Eukaryotic (cells) have a nucleus (1)",
    "Prokaryotic (cells) do not have / lack a nucleus (1)"
  ],
  "acceptableVariants": [
    "Eukaryotes have a nucleus, prokaryotes do not"
  ]
}
```

`acceptableVariants` is optional; if present, marking can treat as alternative correct strings (fuzzy-matched) in addition to the main `correctAnswer`. If omitted, only `correctAnswer` is used (current behaviour).

---

### 2.3 Type: `label` (Label the diagram; image with named regions)

- **Content:** Image URL + list of regions (each with id and optional label text for display).
- **Mark scheme:** For each region, correct label(s) and marks per region. Marks sum to `item.marks`.

```json
{
  "type": "label",
  "question": "Label the parts of the plant cell.",
  "marks": 4,
  "content": {
    "imageUrl": "/uploads/diagram-plant-cell.png",
    "regions": [
      { "id": "A", "label": "" },
      { "id": "B", "label": "" },
      { "id": "C", "label": "" },
      { "id": "D", "label": "" }
    ]
  },
  "correctAnswer": {
    "parts": [
      { "regionId": "A", "accept": ["cell wall"], "marks": 1 },
      { "regionId": "B", "accept": ["cell membrane", "plasma membrane"], "marks": 1 },
      { "regionId": "C", "accept": ["nucleus"], "marks": 1 },
      { "regionId": "D", "accept": ["chloroplast", "chloroplasts"], "marks": 1 }
    ]
  },
  "markScheme": [
    "A: cell wall (1)",
    "B: cell membrane (1)",
    "C: nucleus (1)",
    "D: chloroplast (1)"
  ]
}
```

Marking: for each part, if student’s label for that `regionId` matches any string in `accept` (normalised, optional fuzzy), award that part’s marks. Sum part marks for item score.

---

### 2.4 Type: `table` (Table completion / classification; rows × columns)

- **Content:** Table structure (headers, row labels), empty cells to fill.
- **Mark scheme:** Correct value(s) per cell (or per row/column if marking by row/column). Marks per cell or per row; sum = `item.marks`.

```json
{
  "type": "table",
  "question": "Complete the table to show whether each structure is found in plant cells, animal cells, or both.",
  "marks": 4,
  "content": {
    "headers": ["Structure", "Plant", "Animal", "Both"],
    "rows": [
      { "rowId": "r1", "label": "Cell wall" },
      { "rowId": "r2", "label": "Chloroplast" },
      { "rowId": "r3", "label": "Mitochondrion" },
      { "rowId": "r4", "label": "Nucleus" }
    ],
    "cellsToComplete": ["r1:Plant", "r2:Plant", "r3:Animal", "r4:Both"]
  },
  "correctAnswer": {
    "cells": [
      { "rowId": "r1", "columnKey": "Plant", "accept": ["yes", "✓", "tick"], "marks": 1 },
      { "rowId": "r2", "columnKey": "Plant", "accept": ["yes"], "marks": 1 },
      { "rowId": "r3", "columnKey": "Animal", "accept": ["yes"], "marks": 1 },
      { "rowId": "r4", "columnKey": "Both", "accept": ["yes", "both"], "marks": 1 }
    ]
  },
  "markScheme": [
    "Cell wall: Plant only (1)",
    "Chloroplast: Plant only (1)",
    "Mitochondrion: Animal / Both (1)",
    "Nucleus: Both (1)"
  ]
}
```

Marking: for each entry in `correctAnswer.cells`, find student’s value for that cell (e.g. by `rowId` + `columnKey`). If it matches any of `accept` (normalised/fuzzy as policy), award that part’s marks. Sum part marks.

---

### 2.5 Type: `data` (Data interpretation; read values, comparisons)

- **Content:** Description of data (e.g. graph, table, scenario); question stem.
- **Mark scheme:** One or more sub-questions, each with correct value(s) or comparison and marks. Can reuse “short” style accept logic per part.

```json
{
  "type": "data",
  "question": "The graph shows rate of photosynthesis vs light intensity. (a) What is the rate at 20 units? (b) At what light intensity does rate level off?",
  "marks": 2,
  "content": {
    "description": "Graph: rate of photosynthesis (y) vs light intensity (x). Curve rises then plateaus.",
    "imageUrl": "/uploads/graph-photosynthesis.png"
  },
  "correctAnswer": {
    "parts": [
      { "partId": "a", "accept": ["3.2", "3.2 arbitrary units", "3"], "marks": 1 },
      { "partId": "b", "accept": ["30", "30 units", "about 30"], "marks": 1 }
    ]
  },
  "markScheme": [
    "(a) 3.2 (units) (1)",
    "(b) 30 (units) (1)"
  ]
}
```

Marking: for each `partId`, take student’s answer for that part; if it matches any of `accept` (normalised/fuzzy), award that part’s marks. Sum part marks.

---

## 3. AssessmentAttempt.answers[] Payload Shape (Minimal Change)

Keep one entry per question: `questionId`, `answeredAt`. Reuse existing fields and add one optional structured field so the schema stays minimal.

| Field | Type | Use |
|-------|------|-----|
| `questionId` | ObjectId | Required; links to AssessmentItem. |
| `selectedIndex` | Number \| null | **mcq**: index of selected option. |
| `textAnswer` | String \| null | **short**: single string. **data**: can store JSON string for multi-part, e.g. `{"a":"3.2","b":"30"}`. |
| **`payload`** | Mixed (optional) | **label**: `{ "A": "cell wall", "B": "cell membrane", ... }`. **table**: `{ "r1:Plant": "yes", "r2:Plant": "yes", ... }` or array of `{ rowId, columnKey, value }`. **data**: if not using textAnswer, object per part. |

### 3.1 Payload shape per type

- **mcq**  
  `selectedIndex`: 0-based index. No `payload` (or leave null).

- **short**  
  `textAnswer`: full answer text. No `payload`.

- **label**  
  `payload`: object `{ [regionId]: string }`, e.g. `{ "A": "cell wall", "B": "cell membrane" }`. Optional: also allow `textAnswer` null for this type.

- **table**  
  `payload`: object keyed by cell, e.g. `{ "r1:Plant": "yes", "r2:Plant": "yes" }`, or array `[{ "rowId": "r1", "columnKey": "Plant", "value": "yes" }, ...]`. Backend normalises to one canonical form when marking.

- **data**  
  Option A: `textAnswer` as JSON string `{"a":"3.2","b":"30"}`. Option B: `payload` as `{ "a": "3.2", "b": "30" }`. Choose one and stick to it; marking reads the same shape.

Recommendation: add optional `payload` (Mixed) to the existing Answer sub-schema; keep `selectedIndex` and `textAnswer` for backward compatibility. For **label** and **table**, require `payload` (and optionally allow `textAnswer` for **data** or vice versa).

---

## 4. Marking Algorithm Outline (Deterministic, No LLM)

All marking is done in the backend at submit time (and when generating results). No LLM calls.

### 4.1 mcq

- From item: `options`, `correctAnswer` (or `correctIndex`).
- From answer: `selectedIndex`.
- **Rule:** If `selectedIndex` is null/undefined, treat as unanswered (no marks). Else compute correct index: `correctIndex = options.indexOf(correctAnswer)` or use `correctIndex` if present. If `selectedIndex === correctIndex` → full marks; else 0.
- **Score for item:** 0 or `item.marks` (typically 1).

### 4.2 short

- From item: `correctAnswer`, optional `acceptableVariants`, `marks`.
- From answer: `textAnswer`.
- **Rule:** If `textAnswer` is null/empty/whitespace → 0. Else run existing **fuzzy match + negation awareness** (e.g. token overlap ≥ threshold, negation nearer prokaryotic than eukaryotic). If main `correctAnswer` matches → full marks. If `acceptableVariants` exists and any variant matches (same fuzzy rules) → full marks. Optionally support partial marks (e.g. 1 of 2) by adding a second accept rule or sub-parts in `correctAnswer`; if not, binary full/zero.
- **Score for item:** 0 or `item.marks` (or partial if you extend to 1 mark / 2 marks sub-rules).

### 4.3 label

- From item: `correctAnswer.parts` (each: `regionId`, `accept[]`, `marks`), total `item.marks`.
- From answer: `payload` = `{ [regionId]: studentLabel }`.
- **Rule:** For each part in `correctAnswer.parts`, get student value `payload[regionId]`. Normalise (lowercase, trim). If normalised value is in `accept` (or fuzzy match against any `accept` entry, e.g. Levenshtein ≤ 1) → add `part.marks` to awarded. Sum awarded marks; cap at `item.marks` if sum of part marks exceeds it (safety).
- **Score for item:** Sum of marks awarded per part (capped by `item.marks`).

### 4.4 table

- From item: `correctAnswer.cells` (each: `rowId`, `columnKey`, `accept[]`, `marks`).
- From answer: `payload` (object keyed e.g. `"rowId:columnKey"` or array of `{ rowId, columnKey, value }`).
- **Rule:** Normalise payload to a map `(rowId, columnKey) → value`. For each cell in `correctAnswer.cells`, get student value; normalise; if it matches any of `accept` (or fuzzy) → add `cell.marks`. Sum; cap at `item.marks`.
- **Score for item:** Sum of marks awarded per cell (capped by `item.marks`).

### 4.5 data

- From item: `correctAnswer.parts` (each: `partId`, `accept[]`, `marks`).
- From answer: `payload` or `textAnswer` (JSON) keyed by `partId`.
- **Rule:** For each part, get student answer for `partId`. Same as short: normalise, fuzzy match against `accept`. If match → add `part.marks`. Sum; cap at `item.marks`.
- **Score for item:** Sum of marks awarded per part (capped by `item.marks`).

### 4.6 Attempt-level score

- **totalMarksAvailable** = sum over items in the paper of `item.marks` (or paper-level overrides if present).
- **totalMarksAwarded** = sum of per-item scores from above.
- **percentage** = `totalMarksAwarded / totalMarksAvailable * 100` (or keep current “correct count / totalQuestions” for backward compatibility; recommend adding `totalMarksAwarded` / `totalMarksAvailable` for GCSE-style reporting).
- Store in attempt: e.g. `score.totalMarksAwarded`, `score.totalMarksAvailable`, `score.percentage`, and optionally `score.correct` (number of fully correct items) for backward compatibility.

---

## 5. GCSE-Style Mark Scheme Representation (e.g. AQA)

- **Human-facing:** `markScheme` on the item is an array of strings, one per mark point, e.g.  
  `["Eukaryotic (cells) have a nucleus (1)", "Prokaryotic (cells) do not have a nucleus (1)"]`.  
  Used for display, PDF export, and teacher reference only; not parsed for marking.

- **Machine-facing:** Marking uses only the structured fields: `correctAnswer` (and type-specific `content` for structure). So:
  - **Content** = what the student sees (stem, image, table layout, options).
  - **Mark scheme (display)** = `markScheme[]` (AQA-style bullet points).
  - **Mark scheme (machine)** = `correctAnswer` (+ optional `acceptableVariants` for short, and `content` for region/cell identifiers).

This keeps exam-board realism (mark scheme wording) separate from deterministic marking (structured accept lists and marks per part).

---

## 6. Extensibility and Exam-Board Realism

- **New question types:** Add a new `type` value, extend `correctAnswer` and `content` shapes, add a branch in the marking router that computes item score and pushes to the same `score.totalMarksAwarded` and results structure.
- **Stricter/looser marking:** For short/data, tune fuzzy threshold and negation rules. For label/table, add or remove fuzzy on `accept` lists.
- **Partial marks:** Already supported for label, table, data via multiple parts with individual `marks`. For short, add `correctAnswer.parts` with `accept` and `marks` per part if you want 1 mark for first idea and 1 for second.
- **Mark scheme text:** Always store AQA-style strings in `markScheme`; optional per-part labels in structured `correctAnswer` (e.g. `markSchemeRef: "A: cell wall (1)"`) for linking feedback to mark scheme bullets.

---

## 7. Summary

| Type | Content (display) | Mark scheme (machine) | Student answer | Marking |
|------|-------------------|------------------------|----------------|--------|
| mcq | question, options | correctAnswer / correctIndex | selectedIndex | Index match → full marks |
| short | question | correctAnswer, optional acceptableVariants | textAnswer | Fuzzy + negation → full/partial marks |
| label | content.imageUrl, content.regions | correctAnswer.parts (regionId, accept, marks) | payload[regionId] | Per-region match → sum marks |
| table | content.headers, content.rows, cellsToComplete | correctAnswer.cells (rowId, columnKey, accept, marks) | payload cell map | Per-cell match → sum marks |
| data | question, content.description/imageUrl | correctAnswer.parts (partId, accept, marks) | payload or textAnswer JSON | Per-part fuzzy → sum marks |

All marking is deterministic; short answers keep existing fuzzy logic with negation awareness; diagram and table mark per sub-part and sum marks; content, mark scheme text, and student answer are clearly separated; and the design fits the existing AssessmentItem and AssessmentAttempt.answers[] with minimal schema change (add `payload`, extend `type` and `correctAnswer`/`content` shapes).
