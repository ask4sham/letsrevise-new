# P3.0A–D — Diagram Specification Engine

**Status:** P3.0A/B committed; P3.0C/D implemented (not committed)  
**Date:** June 2026  
**Scope:** Schema, validator, examples, brief composer — **no production wiring**

---

## Purpose

Teacher Brain should eventually emit a **DiagramSpecification** before any image is created. The specification becomes the single source of truth for:

- Image generation (ChatGPT prompt, future API providers)
- Hotspot activities (`interactiveDiagram`)
- Drag & drop / TTI (`dragDropMatch`)
- Label overlays
- Exam questions
- Diagram Asset Library metadata

```
Teacher Brain
      ↓
DiagramSpecification  ←── source of truth (P3.0A)
      ↓
┌─────┴─────┬─────────────┬──────────────┐
│           │             │              │
Prompt     Hotspots    Drag-drop      Exam Q
composer   seeds       seeds          seeds
│           │             │              │
ChatGPT    Editor       Lesson         Assessment
(manual)   placement    blocks         items
```

Image providers are **downstream adapters**. Teacher Brain outputs pedagogy and structure — not pixels.

---

## Why specifications beat image prompts

| Image prompt only | Diagram specification |
|-------------------|----------------------|
| Single-use text blob | Structured, versioned, validatable document |
| Labels implied in prose | Labels are first-class objects with ids, order, examinable flags |
| Hotspots re-authored manually | Hotspot seeds reference label ids before image exists |
| Provider-locked wording | Same spec → ChatGPT prompt, gpt-image-2 brief, or SVG template |
| No exam linkage | `examFocus` and `examQuestions` seeds tied to label ids |
| Hard to diff or reuse | Stable `id` slug reusable across lessons and assets |

A prompt describes **how to draw**. A specification describes **what must be taught, labelled, tested, and interacted with**.

---

## How specifications drive multiple activity types

One validated `DiagramSpecification` can fan out:

| `interactionTypes` | Downstream consumer | Spec fields used |
|---------------------|---------------------|------------------|
| `view` | `diagram` block caption + image | `title`, `labels`, `layout` |
| `hotspot` | `interactiveDiagram` | `activities.hotspots`, `labels[].description` |
| `drag-drop` | `dragDropMatch` (diagram mode) | `activities.dragDrop`, `layout.regions` |
| `tti` | TTI v1/v2/v4 geometry | `labels`, `layout.regions` → box seeds |
| `label-overlay` | Revealable / draggable labels | `labels[]` with `order`, `role` |
| `exam-question` | MCQ / short answer | `activities.examQuestions`, `examFocus` |

The spec stores **intent and references** (`labelId`, `region`). Pixel coordinates (`x`, `y`) are added later in the editor or by a placement tool — not by Teacher Brain.

---

## Swappable image providers

```
DiagramSpecification
        ↓
   ┌────┴────┐
   │ Adapter │  (not built in P3.0A)
   └────┬────┘
        ↓
┌───────┼───────┬────────────┐
│       │       │            │
ChatGPT  gpt-image-2  Manual   SVG template
prompt   API        upload   (future)
```

Teacher Brain never changes when the provider changes. Only the adapter translates `instruction`, `labels`, `layout`, and `visualStyle` into provider-specific requests.

**Current production decision (post P2.4):** ChatGPT manual generation remains the quality renderer. The spec feeds the **Generate Diagram Prompt** step, not in-app image generation.

---

## Schema overview (`schemaVersion: "3.0a"`)

### Diagram types

| Value | Use case |
|-------|----------|
| `hotspot` | Click-to-reveal regions on one image |
| `process` | Ordered pathway (e.g. reflex arc) |
| `labelled` | Static labelled diagram (e.g. photosynthesis) |
| `practical-setup` | Apparatus / method setup (e.g. ruler drop) |
| `compare-contrast` | Side-by-side or before/after (e.g. diffusion) |
| `flowchart` | Branching decision or process flow |

### Core fields

| Field | Required | Description |
|-------|----------|-------------|
| `schemaVersion` | yes | `"3.0a"` |
| `id` | yes | Stable slug (`reflex-arc`) |
| `subject` | yes | e.g. `GCSE Biology` |
| `examBoard` | yes | `AQA`, `Edexcel`, … |
| `tier` | yes | `Foundation` \| `Higher` |
| `topic` | yes | Lesson topic |
| `subtopic` | no | Finer grain |
| `learningGoal` | yes | Student outcome |
| `diagramType` | yes | One of six types above |
| `interactionTypes` | yes | Non-empty array |
| `activityPedagogyType` | when drag-drop/tti | Cognitive task switch (P3.0C) |
| `imageElements` | when pedagogy set | What appears on image (regions, hotspots) |
| `conceptCards` | when pedagogy set | Draggable card text — never in image |
| `title` | yes | Display + image brief title |
| `instruction` | no | Provider-specific brief |
| `examFocus` | no | Examinable skills |
| `difficulty` | no | `foundation` \| `standard` \| `higher` |
| `teacherNotes` | no | Teacher-only notes |
| `labels` | yes | Array of label objects |
| `layout` | yes | Orientation, flow, regions; `complexAnatomy` triggers hotspot mapping |
| `activities` | no | Hotspot, drag-drop, exam seeds |
| `visualStyle` | no | Provider style hints |
| `status` | no | `draft` \| `validated` |

### Label object

```json
{
  "id": "sensory-neurone",
  "text": "SENSORY NEURONE",
  "role": "process-step",
  "order": 3,
  "required": true,
  "examinable": true,
  "mapsTo": "carries impulse to CNS",
  "hotspotId": "C",
  "description": "Optional student-facing explanation"
}
```

---

## Validation rules

Implemented in `backend/services/diagramSpecificationEngine/validator.js`:

1. **Type safety** — root must be a plain object
2. **Schema version** — must be `"3.0a"`
3. **Required curriculum fields** — subject, examBoard, tier, topic, learningGoal, title
4. **Enum checks** — diagramType, interactionTypes, examBoard, orientation, flow, difficulty, label roles
5. **Label integrity** — ≥1 label; unique `id`; unique `hotspotId` when present
6. **Activity references** — hotspot/drag-drop/exam seeds must reference existing `labelId`
7. **Diagram-type rules**
   - `process` / `flowchart`: ≥2 labels with `order`
   - `hotspot` type: should include `hotspot` interaction type
   - `practical-setup` / drag-drop: ≥2 required labels
8. **Pedagogy rules (P3.0C)** — when `interactionTypes` includes `drag-drop` or `tti`:
   - `activityPedagogyType` required (one of six values)
   - `imageElements` required (≥2 items)
   - `conceptCards` required (≥2 items)
9. **Strict mode** — rejects unknown top-level keys (optional `{ strict: true }`)

Returns `{ ok, errors[], normalized }` — never throws.

---

## Example specifications

| id | diagramType | File |
|----|-------------|------|
| `reflex-arc` | `process` | `examples.js` → `REFLEX_ARC_SPEC` |
| `reaction-time-practical` | `practical-setup` | `examples.js` → `REACTION_TIME_PRACTICAL_SPEC` |
| `photosynthesis` | `labelled` | `examples.js` → `PHOTOSYNTHESIS_SPEC` |
| `diffusion-membrane` | `compare-contrast` | `examples.js` → `DIFFUSION_SPEC` |
| `brain-regions-structure-function` | `hotspot` | `examples.js` → `BRAIN_REGIONS_STRUCTURE_FUNCTION_SPEC` |

All five validate with zero errors.

---

## Future integration points

| Phase | Integration | Notes |
|-------|-------------|-------|
| **P3.0B** | Teacher Brain emits `DiagramSpecification` JSON | Add to lesson export behind flag; validate on ingest |
| **P3.1** | Prompt composer adapter | `spec → ChatGPT prompt` for "Generate Diagram Prompt" button |
| **P3.2** | Diagram Asset Library metadata | Map `labels`, `examFocus`, `topic` to `DiagramAsset` fields on upload |
| **P3.3** | Activity seeding | `activities.hotspots` → `interactiveDiagram` block draft |
| **P3.4** | TTI seeding | `layout.regions` + labels → TTI box geometry draft |
| **P3.5** | Exam item generation | `activities.examQuestions` → checkpoint blocks |
| **Future** | API image adapter | Optional `gpt-image-2` path if human QA gate added |

**Explicitly not in P3.0A:** routes, UI, Teacher Brain prompts, image generation, asset library changes.

---

## File layout

```
backend/services/diagramSpecificationEngine/
  schema.js              — enums + JSDoc types
  validator.js             — validateDiagramSpecification()
  examples.js              — five GCSE Biology examples
  briefComposer.js         — composeDiagramBrief() (P3.0B/D)
  pedagogyBriefRules.js    — pedagogy profiles + brief sections (P3.0C/D)
  index.js                 — barrel export

backend/tests/diagramSpecificationEngine.test.js
backend/tests/diagramBriefComposer.test.js

docs/design/diagram-specification-engine.md          ← this document
docs/design/STRUCTURE_FUNCTION_DRAG_DROP_IMAGE_RULES.md  ← canonical DnD image rules
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| Spec drift from lesson block shapes | Keep spec as superset; adapters map to existing block contracts |
| Teacher Brain emits invalid JSON | Validator + `status: draft` until human review |
| Over-specification too early | P3.0A examples are hand-authored; tune schema before TB wiring |
| Coordinate placement still manual | Spec stores regions, not x/y — editor remains source of pixel truth |
| Duplicate concepts vs P2.0A `DiagramQualitySpec` | P3.0A spec is canonical; spike prompt composer becomes an adapter later |

---

## Safety checks

| Check | Status |
|-------|--------|
| Teacher Brain unchanged | ✅ |
| `ai.js` unchanged | ✅ |
| Lesson generation unchanged | ✅ |
| Editor unchanged | ✅ |
| Assessment unchanged | ✅ |
| Diagram Asset Library unchanged | ✅ |
| No production behaviour changed | ✅ |
| No secrets committed | ✅ |
| **Commit status** | **P3.0A/B committed; P3.0C/D not committed — awaiting review** |

---

## How to run tests

```bash
cd backend
npx jest tests/diagramSpecificationEngine.test.js tests/diagramBriefComposer.test.js
```

---

## Relationship to prior phases

| Phase | Relationship |
|-------|--------------|
| P2.0A / P2.4 spikes | `DiagramQualitySpec` → future adapter input; not replaced yet |
| P2.1 Diagram Asset Library | Asset metadata will eventually mirror spec fields |
| P2.4 verdict | ChatGPT manual workflow preserved; spec feeds prompt export |
| P2.5 | API ≠ ChatGPT native path; spec is provider-agnostic by design |
| **P3.0B** | `composeDiagramBrief()` — spec → ChatGPT-ready prompt text |
| **P3.0C/D** | `activityPedagogyType` + pedagogy-driven brief branching |

---

## P3.0B — Diagram Brief Composer

**Status:** Implemented (not wired to production)  
**Module:** `backend/services/diagramSpecificationEngine/briefComposer.js`

### Purpose

Convert a **validated** `DiagramSpecification` into a structured, human-readable, ChatGPT-ready diagram brief — matching the style of prompts already proven successful for LetsRevise GCSE diagrams.

```
DiagramSpecification
        ↓ validateDiagramSpecification()
        ↓ composeDiagramBrief(spec, options)
        ↓
ChatGPT-ready brief (string)
        ↓
Teacher pastes into ChatGPT → high-quality diagram
        ↓
Upload to Diagram Asset Library
```

### API

```js
const { composeDiagramBrief } = require("./services/diagramSpecificationEngine");

const result = composeDiagramBrief(spec, {
  includeFrame: true,
  includeAnswerKey: true,
  includeHotspots: true,
  includeInteractionNotes: true,
  brandName: "LetsRevise",
  examStyle: "GCSE AQA Higher Tier Biology", // optional override
});
```

**Success:**

```json
{
  "ok": true,
  "brief": "…",
  "warnings": [],
  "metadata": {
    "specId": "reflex-arc",
    "diagramType": "process",
    "interactionTypes": ["view", "hotspot", "drag-drop", "exam-question"],
    "labelCount": 8,
    "hotspotCount": 8
  }
}
```

**Failure (invalid spec):**

```json
{
  "ok": false,
  "brief": "",
  "errors": [{ "path": "…", "message": "…", "code": "…" }],
  "warnings": [],
  "metadata": null
}
```

### Brief structure

The composer assembles these sections in order:

1. Opening line (`Create a GCSE AQA Higher Tier Biology diagram.`)
2. **Instruction** — learning goal, topic, provider brief
3. **Labels to use** — required labels with `mapsTo` hints
4. **Hotspots / parts** — when `hotspot`, `drag-drop`, or `tti` interaction types apply
5. **Answer key** — letter → label mapping (optional)
6. **Drag-and-drop targets** — card prompts (optional)
7. **Interaction notes** — teacher-facing; not rendered in image
8. **STYLE** — GCSE exam diagram rules (white background, thick outlines, etc.)
9. **LAYOUT** — orientation, flow, regions
10. **OUTPUT** — flat vector, exam ready, copyright safe
11. **COPYRIGHT** — originality rules
12. **THEN** — LetsRevise frame rules (optional)

### How spec → brief works

| Spec field | Brief section |
|------------|---------------|
| `subject`, `examBoard`, `tier` | Opening line |
| `learningGoal`, `instruction`, `examFocus` | Instruction |
| `labels[]` | Labels to use |
| `activities.hotspots[]` | Hotspots / parts + Answer key |
| `activities.dragDrop[]` | Drag-and-drop targets |
| `layout` | LAYOUT |
| `visualStyle` | OUTPUT style hints |
| `interactionTypes` | Controls which activity sections appear |
| `teacherNotes` | Omitted (warning only) |

The composer **always validates first** via `validateDiagramSpecification()`. Invalid specs never produce a brief.

### Manual ChatGPT workflow (today)

After P2.4 and P2.5, production diagram quality comes from **manual ChatGPT generation**. P3.0B closes the gap between Teacher Brain's structured intent and ChatGPT's prompt format:

1. Teacher Brain eventually emits a `DiagramSpecification`
2. `composeDiagramBrief()` produces the paste-ready prompt
3. Teacher clicks **Generate Diagram Prompt** (future UI) → opens ChatGPT
4. Teacher downloads image → Diagram Asset Library → lesson block

No in-app image generation. No OpenAI API calls in P3.0B.

### API generation (later)

The same spec can feed other adapters without changing Teacher Brain:

| Adapter | Input | Output |
|---------|-------|--------|
| `briefComposer` (P3.0B) | spec | ChatGPT paste prompt |
| `gpt-image-2` adapter (future) | spec | API image request |
| SVG template adapter (future) | spec | Programmatic diagram |

Only the adapter changes. The specification stays the source of truth.

### Why the specification stays provider-independent

- **Labels** are structured objects, not prose buried in a prompt
- **Hotspots** reference `labelId`, not pixel coordinates
- **Exam questions** are seeds, not image text
- **Style rules** are defaults with provider overrides in options
- Swapping ChatGPT for API or manual upload does not require re-authoring pedagogy

### Tests

```bash
cd backend
npx jest tests/diagramBriefComposer.test.js
npx jest tests/diagramSpecificationEngine.test.js
```

**P3.0B commit status:** Committed (`f11ed49`).

---

## P3.0C — Activity pedagogy type

**Status:** Implemented (not committed)  
**Module:** `schema.js`, `validator.js`, `pedagogyBriefRules.js`

### Problem

Teacher Brain knows content but not the **cognitive task**. Without `activityPedagogyType`, drag-and-drop image briefs use the same "Labels to use" strategy as static diagrams — revealing answers and removing retrieval practice.

### New fields

| Field | Type | When required |
|-------|------|---------------|
| `activityPedagogyType` | enum | When `interactionTypes` includes `drag-drop` or `tti` |
| `imageElements` | `string[]` | When pedagogy type set (≥2 items) |
| `conceptCards` | `string[]` | When pedagogy type set (≥2 items) |
| `layout.complexAnatomy` | `boolean` | Optional — triggers hotspot mapping rule |

### Pedagogy types

| Value | Student recalls | Cards contain |
|-------|-----------------|---------------|
| `structure-to-function` | Structure from function | Functions only |
| `function-to-structure` | Function from structure | Structure names |
| `label-to-structure` | Structure from label prompt | Structure names |
| `process-step-to-order` | Correct step order | Stage descriptions |
| `cause-to-effect` | Effect from cause | Effects or causes |
| `variable-to-definition` | Definition from variable | Definitions |

Internal `labels[]` remain for answer keys, asset metadata, and reveal text — but **must not be copied into the image brief** for retrieval activities.

See [STRUCTURE_FUNCTION_DRAG_DROP_IMAGE_RULES.md](./STRUCTURE_FUNCTION_DRAG_DROP_IMAGE_RULES.md) for the canonical Structure→Function pattern.

---

## P3.0D — Pedagogy-driven brief composer

**Status:** Implemented (not committed)  
**Module:** `briefComposer.js`, `pedagogyBriefRules.js`

### Branching

`composeDiagramBrief()` validates first, then branches:

| Condition | Brief path |
|-----------|------------|
| `activityPedagogyType` set | `composePedagogyDrivenBrief()` — Image Elements + Concept Cards + MUST NOT list |
| No pedagogy type | `composeLabelledDiagramBrief()` — legacy "Labels to use" path |

### Pedagogy brief sections

1. Opening line + activity pedagogy type
2. Instruction (learning goal, topic, exam focus)
3. **PEDAGOGY VALIDATION** — recall task + MUST NOT list
4. **Image Elements** — visual regions and numbered hotspots
5. **Concept Cards** — application-rendered text (never in image)
6. Student task description
7. **HOTSPOT MAPPING RULE** — when `layout.complexAnatomy` or brain/eye/heart topics
8. Teacher answer key — hotspot ↔ card numbers only (no label text)
9. Interaction notes, STYLE, LAYOUT, OUTPUT, COPYRIGHT, frame

### Example: brain regions (`structure-to-function`)

Key differences from legacy brief:

- Uses **Image Elements** and **Concept Cards**, not **Labels to use**
- No `HYPOTHALAMUS` or function text in sections sent before Concept Cards
- Numbered hotspot mapping for complex anatomy
- Answer key uses hotspot/card indices — structure names stay in spec metadata only

### Tests

```bash
cd backend
npx jest tests/diagramBriefComposer.test.js
npx jest tests/diagramSpecificationEngine.test.js
```

**24 tests passing** (13 engine + 11 brief composer).

**P3.0C/D commit status:** Not committed — awaiting review.

---

## P3.0D.1 — Region-ID abstraction (structure-to-function)

**Status:** Implemented  
**Module:** `pedagogyBriefRules.js`, `briefComposer.js`

### Problem

Image models may render biological structure names as visible labels when they appear in Image Elements or Exam focus — even when marked as design instructions.

### Solution

For `activityPedagogyType: "structure-to-function"` only:

| Output | Content |
|--------|---------|
| `brief` | Region 1–N IDs only — no biological names, no concept cards, no exam focus with structure names |
| `teacherMetadata` | Region ↔ structure mappings, concept cards, full answer key — **never sent to image generator** |

### API change

```js
const result = composeDiagramBrief(spec);
// result.brief            → paste into ChatGPT
// result.teacherMetadata  → teacher/app only
// result.metadata.regionIdAbstracted → true for structure-to-function
```

### Example image brief excerpt

```
Image Elements:
• Region 1 highlighted
• Region 2 highlighted
• Numbered hotspot 1 on Region 1 + matching 1 beside overlay row
…
```

### Example teacher metadata excerpt

```
TEACHER METADATA (NOT FOR IMAGE):

Region 1 = Hypothalamus
Region 2 = Pituitary Gland
…

Concept Cards (application-rendered):
• Thermoregulation control centre
…
```
