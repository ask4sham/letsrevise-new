# LetsRevise Composite Exam Engine V2

**Canonical Architecture Specification (Stable)**

Status: **Phase 0 frozen. Phase 1 (Table) in progress on `feature/exam-composite-table`.**

Primary objective: **zero regression**. No breaking of any existing stable functionality.

---

## Git milestones (recovery points)

| Tag | Commit | Purpose |
|-----|--------|---------|
| `exam-composite-v2-spec` | `5af44e5c` | Canonical architecture + type contracts. **No runtime change.** Permanent design reference. |
| `exam-composite-v2-phase0` | `3db0276f` | Structural extract: shell, router, registry, flags, schema reader. **No behavioural change.** |
| `exam-composite-v2-phase0-baseline` | `ec57056f` | **Verified working** Phase 0 (includes compile-structure fixes). Recovery point before Phase 1 (Table). |
| `exam-composite-table-checkanswer-v1` | `9ed28825` | Table routing + footer Check answer restored. Local smoke verified. |

Related stability tag: `lesson-lifecycle-stability-v1` (`1b30b536`).

**Phase 0 is frozen.** Do not modify Phase 0 commits or structure. Every future phase branches from `exam-composite-v2-phase0-baseline`.

---

## Design principles

The architecture is governed by six non-negotiable principles:

1. **Existing composite questions must continue working without modification.**
2. **Existing lessons, exam questions, and AI generation must not regress.**
3. **New question types must be additive**, never replacing existing renderers.
4. **Every interaction type must be isolated** (renderer bug cannot break other types).
5. **The engine must support Edexcel, AQA, and OCR style papers.**
6. **The engine must become the foundation of the future Exam Paper Builder.**

---

## Stability contract (do not break)

| Area | Rule |
|------|------|
| V1 composite questions (`mcq` / `short`, no `partData`) | Render and mark identically forever |
| Lesson embedded exam lifecycle | See tag `lesson-lifecycle-stability-v1` |
| Exam inline images | Original `.png` inline; `.display.png` in DB only |
| Lightbox | Fit-to-viewport on open (`ZoomableImageLightbox`) |
| Upload pipeline | `lessonPngDisplay.js` unchanged |
| Drag-drop overlays | `.display.png` coordinate system unchanged until Phase 5 wrapper only |
| Single exam questions | Unchanged |

---

## Current architecture (V1)

Composite questions today:

```
Composite Question
├── Shared image
├── Shared stem
├── Part (a)
├── Part (b)
└── Part (c)
```

Each part supports:

- MCQ
- Short answer

**This remains untouched.** V1 behaviour is the regression baseline.

---

## Composite Exam Engine V2

### Before (monolithic)

```
CompositeQuestion
  if MCQ …
  else Short …
```

### After (plugin architecture)

```
Composite Question
  ↓
Composite Exam Shell
  ↓
Composite Part Router
  ↓
Renderer Registry (typed)
  ↓
  Renderer
  Validator
  Marker
  Feedback
```

Each interaction plugin is **completely independent**.

---

## Shell responsibilities

`CompositeExamShell` **only** controls:

- Title
- Exam board / meta line
- Total marks
- Shared diagram
- Shared stem
- Part ordering
- Part numbering (a), (b), (c)…

It knows **nothing** about individual interaction types.

---

## Router

`CompositePartRouter` dispatches by `part.type`:

| Type | Plugin |
|------|--------|
| `MCQ` | `McqRenderer` (+ validator, marker, feedback) |
| `SHORT` | `ShortRenderer` |
| `TABLE` | `TableRenderer` |
| `GRAPH` | `GraphRenderer` |
| … | … |

**Unknown types:** graceful fallback → never crash → developer warning only (production-safe).

---

## Typed registry

**Do not** use string lookup: `registry["table"]`.

Use typed constants:

```ts
CompositePartType.MCQ
CompositePartType.SHORT
CompositePartType.TABLE
CompositePartType.CALCULATION
CompositePartType.GRAPH
CompositePartType.LABEL
CompositePartType.MATCHING
CompositePartType.ORDERING
CompositePartType.EXTENDED_RESPONSE
```

This prevents silent spelling mistakes from breaking rendering.

Source of truth: `types.ts` in this folder (frontend) and mirrored constants in backend when implemented.

---

## Schema versioning

Every composite question may include:

```ts
schemaVersion: 1 | 2
```

| Version | Meaning |
|---------|---------|
| **1** | Current questions (implicit if omitted). `mcq` / `short` only. No `partData`. |
| **2** | Plugin architecture. `partData` allowed. New interaction types. |

**Old questions require zero migration.** Missing `schemaVersion` is treated as `1`.

Question-level fields (unchanged):

- `questionMode: "composite"`
- `sharedStem`, `imageUrl`, `title`, `totalMarks`, `parts[]`

---

## Part schema

Every part contains (V1 + V2):

| Field | Required | Notes |
|-------|----------|-------|
| `label` | Yes | e.g. `"a"`, `"b"` |
| `type` | Yes | `CompositePartType` value |
| `marks` | Yes | Part mark allocation |
| `questionText` | Yes | Visible prompt |
| `markScheme` | Yes | Marking lines |
| `options`, `correctIndex` | MCQ only | Unchanged V1 shape |
| `partData` | V2 only | Interaction-specific structure |

**Naming:** use `partData`, not `payload` — clearer for teachers and developers.

### `partData` examples (illustrative)

**MCQ** — use top-level `options` / `correctIndex` (no `partData` required).

**Table**

```json
{
  "headers": ["Component", "Increase (%)"],
  "rows": [{ "label": "Calcium", "answer": "12" }],
  "correctAnswers": { … }
}
```

**Graph**

```json
{
  "graphImage": "…",
  "questions": [ … ]
}
```

**Calculation**

```json
{
  "values": { … },
  "unit": "cm³",
  "workingRequired": true
}
```

---

## Interaction families (not dozens of question types)

Group exam **wording** under **interaction** renderers:

| Interaction family | Supports (exam verbs) |
|--------------------|------------------------|
| **Multiple choice** | MCQ |
| **Short response** | Short answer, Explain, State, Describe, Suggest, Calculation |
| **Table** | Complete table, Data interpretation |
| **Graph** | Graph reading, Graph analysis |
| **Image annotation** | Label diagrams, Hotspots |
| **Matching** | Drag and drop, Match pairs |
| **Ordering** | Sequencing, Life cycles, Practical method |
| **Extended response** | 6 mark, Level response |

This reduces renderer duplication. Calculation is short-response + `partData` (working box, units). Data interpretation reuses table interaction in Phase 3.

---

## Separation of concerns

Each interaction plugin exports **four modules**:

| Module | Responsibility |
|--------|----------------|
| **Renderer** | Student UI (exam-paper styling) |
| **Validator** | Teacher draft/publish rules |
| **Marker** | Scoring |
| **Feedback** | Post-check explanation |

Future AI marking plugs into **Marker** only.

---

## Feature flags

Every new interaction ships **disabled** until verified:

| Flag | Interaction |
|------|-------------|
| `TABLE_PARTS_ENABLED` | Table |
| `CALCULATION_PARTS_ENABLED` | Calculation |
| `DATA_INTERPRETATION_PARTS_ENABLED` | Data interpretation |
| `GRAPH_PARTS_ENABLED` | Graph |
| `LABEL_PARTS_ENABLED` | Diagram labelling |
| `MATCHING_PARTS_ENABLED` | Matching |
| `ORDERING_PARTS_ENABLED` | Ordering |
| `EXTENDED_RESPONSE_PARTS_ENABLED` | Extended / 6-mark |

Production can disable a single renderer instantly without schema changes.

---

## Regression strategy

| Existing | Behaviour |
|----------|-----------|
| MCQ parts | Current renderer (extracted, not rewritten) |
| Short parts | Current renderer (extracted, not rewritten) |
| New types | New plugins only |

### Compatibility matrix

| Existing feature | Behaviour |
|------------------|-----------|
| Existing lessons | Unchanged |
| Existing composite questions | Unchanged |
| Existing AI generation | Unchanged |
| Existing mark schemes | Unchanged |
| Existing lightbox | Unchanged |
| Existing upload pipeline | Unchanged |
| Existing image rendering | Unchanged |
| Existing lesson lifecycle | Unchanged |

---

## Exam Question image policy

(Related stable behaviour — not part of V2 engine but must not regress.)

- **Stored:** `imageUrl` may point at `*.display.png` (upload pipeline).
- **Inline (exam):** `ExamQuestionBlock` resolves to original `*.png` via `resolveExamQuestionImageSrc`.
- **Lightbox:** full-resolution image; fit-to-viewport on open.
- **Lesson diagrams / drag-drop:** may continue using `.display.png` where normalised layout or coordinates require it.

---

## Future question types (via plugins, no shell changes)

MCQ, Short answer, Explain, State, Describe, Suggest, Complete table, Data interpretation, Graph analysis, Calculations, Ordering, Matching, Label diagram, Practical method, Extended response (6 mark), Experimental design, Evaluate, Compare, Complete flow chart.

---

## Future Exam Paper Builder

Same engine:

```
Exam Paper
├── Question 1 (composite → parts[])
├── Question 2 (composite → parts[])
└── Question 3 (composite → parts[])
```

Surfaces: lesson exams, exam practice, homework, teacher tests, AI-generated papers, mock exams. **No second rendering engine.**

---

## Implementation roadmap

### Phase 0 — Internal refactor ✅ COMPLETE (frozen)

- Extract `CompositeExamShell`
- Extract `CompositePartRouter`
- Create typed registry (`registry.tsx`)
- Introduce `schemaVersion` (read path; default V1)
- Add feature-flag infrastructure
- Unknown-type graceful fallback
- **Regression testing only — zero behavioural change**

Tag: `exam-composite-v2-phase0-baseline`

### Phase 1 — Table interaction **ONLY** (shipping)

**Scope:** one new interaction. Nothing else (no calculation, graph, or label).

- Table editor, renderer, validator, marker, feedback
- Supports: `headers`, `rows`, editable cells, mark scheme
- Source flag `TABLE_PARTS_ENABLED` — **OFF** by default
- Production enable via Netlify build env `REACT_APP_TABLE_PARTS_ENABLED=true`

**Must not affect:** existing MCQ or Short parts.

Recovery tag: `exam-composite-table-checkanswer-v1` (`9ed28825`)

### Phase Completion Checklist (every phase before merge)

#### Functional
- [ ] Existing MCQ unchanged
- [ ] Existing Short Answer unchanged
- [ ] Existing composite questions render identically
- [ ] Existing mark schemes unchanged

#### UI
- [ ] Desktop
- [ ] Tablet
- [ ] Mobile
- [ ] Lightbox
- [ ] Original PNG policy

#### Lesson integrity
- [ ] Placenta lesson
- [ ] FSH/LH lesson
- [ ] At least one older Biology lesson using embedded exam questions

#### Technical
- [ ] Build passes
- [ ] Existing tests pass
- [ ] New interaction tests pass
- [ ] Feature flag OFF = no visible behaviour change

#### Phase 1 acceptance (before merge)

| Area | Requirement |
|------|-------------|
| Existing MCQ parts | Identical |
| Existing Short parts | Identical |
| New capability | Table interaction only |
| Regression lessons | Role of the Placenta, FSH/LH menstrual cycle |
| Lesson lifecycle | `lesson-lifecycle-stability-v1` |
| Images | Original PNG inline policy |
| Lightbox | Fit-to-viewport on open |
| Mobile | Smoke test |

### Phase 2 — Calculation interaction

- Working box, unit validation, numerical marking

### Phase 3 — Data interpretation

- Reuse table interaction

### Phase 4 — Graph questions

### Phase 5 — Diagram labelling

- Wrap existing drag-drop; **do not** change coordinate system

### Phase 6 — Extended response

- Large text box, level-based marking

---

## File structure (target)

```
frontend/src/components/lesson/examComposite/
├── README.md                 ← this document
├── types.ts                  ← CompositePartType, schemaVersion, part interfaces
├── CompositeExamShell.tsx
├── CompositePartRouter.tsx
├── registry.ts
├── featureFlags.ts
├── registry.tsx              ← typed registry + V1 plugins (mcq, short)
├── featureFlags.ts
└── interactions/             ← Phase 1+ plugins added here (table first)
    └── table/                ← Phase 1 only

backend/
├── constants/compositePartTypes.js   ← mirror of frontend enum
└── utils/compositeExamQuestion.js    ← version-aware validate/normalise
```

`ExamQuestionBlock.tsx` delegates composite mode to `CompositeExamShell` after Phase 0.

---

## Acceptance criteria (implementation complete)

- [ ] All existing composite questions render identically
- [ ] Existing mark schemes unchanged
- [ ] Existing AI-generated questions remain compatible
- [ ] No database migration required
- [ ] V1 and V2 questions coexist seamlessly
- [ ] Every new interaction can be enabled/disabled independently
- [ ] Every interaction has Renderer, Validator, Marker, Feedback
- [ ] Same engine can power lesson exams, exam practice, homework, teacher tests, AI papers, mocks, exam paper builder

---

## Phase 0 regression checklist

Before any new interaction ships:

1. Role of the Placenta — composite MCQ + short, typing, marking, summary panel
2. `lesson-lifecycle-stability-v1` — background refresh, no exam unmount
3. `ExamQuestionBlock.test.tsx` — all pass
4. Inline image + lightbox smoke test
5. Editor preview matches student view for V1 composites

---

## Document history

| Date | Change |
|------|--------|
| 2026-07-08 | Initial frozen specification (V2 architecture) |
| 2026-07-08 | Phase 0 complete; milestones tagged; Phase 1 scope tightened (Table only) |
