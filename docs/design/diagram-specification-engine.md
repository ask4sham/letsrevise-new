# P3.0A — Diagram Specification Engine Foundation

**Status:** Architecture foundation only  
**Date:** June 2026  
**Scope:** Schema, validator, examples — **no production wiring**

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
| `title` | yes | Display + image brief title |
| `instruction` | no | Provider-specific brief |
| `examFocus` | no | Examinable skills |
| `difficulty` | no | `foundation` \| `standard` \| `higher` |
| `teacherNotes` | no | Teacher-only notes |
| `labels` | yes | Array of label objects |
| `layout` | yes | Orientation, flow, regions |
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
8. **Strict mode** — rejects unknown top-level keys (optional `{ strict: true }`)

Returns `{ ok, errors[], normalized }` — never throws.

---

## Example specifications

| id | diagramType | File |
|----|-------------|------|
| `reflex-arc` | `process` | `examples.js` → `REFLEX_ARC_SPEC` |
| `reaction-time-practical` | `practical-setup` | `examples.js` → `REACTION_TIME_PRACTICAL_SPEC` |
| `photosynthesis` | `labelled` | `examples.js` → `PHOTOSYNTHESIS_SPEC` |
| `diffusion-membrane` | `compare-contrast` | `examples.js` → `DIFFUSION_SPEC` |

All four validate with zero errors.

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
  schema.js       — enums + JSDoc types
  validator.js    — validateDiagramSpecification()
  examples.js     — four GCSE Biology examples
  index.js        — barrel export

backend/tests/diagramSpecificationEngine.test.js

docs/design/diagram-specification-engine.md   ← this document
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
| **Commit status** | **Not committed — awaiting review** |

---

## How to run tests

```bash
cd backend
npx jest tests/diagramSpecificationEngine.test.js
```

---

## Relationship to prior phases

| Phase | Relationship |
|-------|--------------|
| P2.0A / P2.4 spikes | `DiagramQualitySpec` → future adapter input; not replaced yet |
| P2.1 Diagram Asset Library | Asset metadata will eventually mirror spec fields |
| P2.4 verdict | ChatGPT manual workflow preserved; spec feeds prompt export |
| P2.5 | API ≠ ChatGPT native path; spec is provider-agnostic by design |
