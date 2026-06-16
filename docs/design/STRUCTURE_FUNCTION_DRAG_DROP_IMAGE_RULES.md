# Structure → Function Drag-and-Drop Image Rules

**Status:** Canonical reference  
**Date:** June 2026  
**Scope:** Image brief strategy for drag-and-drop activities — Teacher Brain, Diagram Specification Engine, ChatGPT prompt export  
**Not in scope:** Renderer changes, lesson generation, editor UI (unless noted)

---

## Core problem

Teacher Brain knows **what content to teach** but must also know **what cognitive task the student is performing**.

Without that distinction, image briefs use the same strategy for every drag-and-drop activity. The image may be scientifically correct but **pedagogically incorrect** — it reveals answers and removes retrieval practice.

**Root cause:** missing `activityPedagogyType` on diagram specifications.

**Fix:** classify the cognitive task first → generate image elements that support recall, never reveal answers.

---

## Validation rule (Teacher Brain)

Before generating any drag-and-drop image brief, answer:

> **What exactly is the student trying to recall?**

Then ensure:

> **The image never contains the answer.**

---

## Application vs image ownership

| Layer | Owns |
|-------|------|
| **Application** | Drop zones, dotted boxes, answer boxes, draggable cards, reveal states |
| **Image** | Diagram, highlighted structures, numbered hotspot markers |

This split is unchanged. The fix is **what** the image draws, not who owns overlays.

---

## Activity pedagogy types

`activityPedagogyType` is the key switch controlling image-generation behaviour.

| Value | Student recalls | Image shows | Cards contain |
|-------|-----------------|-------------|---------------|
| `structure-to-function` | Structure from function | Structures + numbered hotspots only | Functions only |
| `function-to-structure` | Function from structure | Structures + numbered hotspots only | Functions only |
| `label-to-structure` | Structure from label prompt | Unlabelled structures + numbered hotspots | Structure names |
| `process-step-to-order` | Correct step order | Process stages + numbered hotspots | Stage descriptions |
| `cause-to-effect` | Effect from cause | Diagram + numbered hotspots | Effects or causes (per design) |
| `variable-to-definition` | Definition from variable | Diagram + numbered hotspots | Definitions |

Required when `interactionTypes` includes `drag-drop` or `tti`.

---

## Canonical pattern: Structure → Function

### Image contains

- Diagram with structures **visually highlighted** (colour regions, not text labels)
- Numbered hotspot markers on each target structure (`1`, `2`, `3`, `4`)
- **Matching hotspot numbers beside each overlay row** on the right rail
- LetsRevise frame (when requested)

### Image does NOT contain

- Structure names (e.g. HYPOTHALAMUS)
- Function names or descriptions
- Answers or definitions
- Concept card text
- Dotted boxes or drop zones (app-rendered)

### Concept cards contain

Functions only. Example:

- Thermoregulation control centre
- Master gland for endocrine control
- Controls breathing and heart rate
- Coordinates balance and movement

### Student task

**Function → Recall Structure** (match function description to numbered region)

### After check

Reveal: structure name + function + explanation

---

## Image Elements vs Required Labels

For drag-and-drop pedagogy types, **do not use "Required Labels"** in image briefs.

Use two separate sections:

**Image Elements** — what appears visually on the diagram (regions, hotspots, numbers):

```
• Region 1 highlighted
• Region 2 highlighted
• Region 3 highlighted
• Region 4 highlighted
• Numbered hotspot 1 on Region 1
• Numbered hotspot 2 on Region 2
• Numbered hotspot 3 on Region 3
• Numbered hotspot 4 on Region 4
```

**Teacher Metadata (NOT FOR IMAGE)** — biological mappings for teachers and application only:

```
Region 1 = Hypothalamus
Region 2 = Pituitary gland
Region 3 = Medulla
Region 4 = Cerebellum
```

**Concept Cards** — what the application renders as draggable text (never in image):

```
• Thermoregulation control centre
• Master gland for endocrine control
• Controls breathing and heart rate
• Coordinates balance and movement
```

Internal `labels[]` in the specification remain for answer keys, asset metadata, and reveal text — but **must not be copied into the image brief** for retrieval activities. For `structure-to-function`, biological structure names are kept in `teacherMetadata` only (P3.0D.1).

---

## Hotspot mapping rule (complex anatomy)

For complex anatomy, **do not rely on horizontal alignment alone**.

Applies to:

- Brain
- Eye
- Heart
- Nephron
- Reflex arc
- Endocrine / hormonal systems

Generate explicit paired markers:

```
Hotspot 1 on structure  ↔  Hotspot 1 beside row
Hotspot 2 on structure  ↔  Hotspot 2 beside row
Hotspot 3 on structure  ↔  Hotspot 3 beside row
Hotspot 4 on structure  ↔  Hotspot 4 beside row
```

This removes ambiguity while preserving retrieval practice.

Set `layout.complexAnatomy: true` on the specification to trigger this rule in the brief composer.

---

## Issues discovered during testing (Brain Regions)

| Issue | Problem | Rule |
|-------|---------|------|
| 1 — Image revealed answers | Structure names on image + function cards = trivial match | No structure or function text on image |
| 2 — Labels removed entirely | Students couldn't identify regions | Use numbered hotspots instead |
| 3 — Hotspots disconnected from drop zones | Mental mapping added cognitive load | Repeat hotspot number beside each row |
| 4 — Function text as image labels | Answers on image | Functions belong on cards only |
| 5 — Blank rail alignment insufficient | Works for simple pathways, not anatomy | Numbered hotspot mapping for complex anatomy |
| 6 — Ownership confusion | — | App owns overlays; image owns diagram + markers |

---

## Diagram specification fields (P3.0C)

```json
{
  "activityPedagogyType": "structure-to-function",
  "imageElements": ["Hypothalamus region highlighted", "Numbered hotspot 1–4"],
  "conceptCards": ["Thermoregulation control centre", "..."],
  "layout": { "complexAnatomy": true }
}
```

---

## Brief composer behaviour (P3.0D)

`composeDiagramBrief()` branches on `activityPedagogyType`:

- **structure-to-function** → Image Elements + Concept Cards + hotspot mapping + "MUST NOT" list
- **label-to-structure** → unlabelled structures + numbered hotspots + structure names on cards
- **process-step-to-order** → stages + numbered hotspots + stage descriptions on cards
- **(no pedagogy type)** → legacy "Labels to use" path for static labelled diagrams

See `backend/services/diagramSpecificationEngine/briefComposer.js`.

---

## Workflow integration

```
Teacher Brain
      ↓
DiagramSpecification (+ activityPedagogyType)
      ↓
composeDiagramBrief()
      ↓
ChatGPT-ready brief (pedagogy-correct)
      ↓
Manual ChatGPT image generation
      ↓
Diagram Asset Library → lesson block
```

No change to lesson generation until Teacher Brain emits specifications with `activityPedagogyType`.

---

## Related documents

- [diagram-specification-engine.md](./diagram-specification-engine.md) — P3.0A/B/C/D schema and composer
- [DRAG_DROP_VISUAL_CONTRACT.md](./DRAG_DROP_VISUAL_CONTRACT.md) — artboard dimensions and app overlay ownership
