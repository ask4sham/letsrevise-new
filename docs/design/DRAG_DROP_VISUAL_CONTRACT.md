# Drag-and-drop visual design contract

**Status:** Frozen specification (Phase 1)  
**Scope:** Text-to-image main image (`dragDropMatch` + `block.imageUrl` + side-by-side worksheet) and shared artwork standards for Teacher Brain, generators, and image prompts.  
**Not in scope for this document:** Renderer changes, CSS changes, save/persistence, upload pipelines, or lesson data.

---

## Purpose

LetsRevise drag-and-drop and text-to-image activities depend on **aligned dimensions** between:

1. **Activity images** (diagram + marker letters A–D on the right rail for text-to-image; printed empty drop rectangles for diagram mode)
2. **In-app concept cards** (right-hand panel, rendered by the application)
3. **Interactive overlay markers** (HTML drop-zone rectangles on the diagram — **runtime only** for text-to-image)

When image assets are designed without these numbers, the diagram and UI fight each other (e.g. misaligned printed boxes vs runtime overlays, inconsistent spacing, cards ~260×60–80px while reserved overlay areas do not match).

This contract freezes **measured** dimensions from the current renderer and a reference portrait asset (`reflex-arc-drag-drop-match-portrait.svg`, artboard 900×1350) so future work can align **Teacher Brain and image generation** to what the UI already uses — without changing working code in Phase 1.

---

## Official standard (frozen)

| Element | Standard |
|--------|------------|
| **Artboard** | **900 × 1350** portrait (2∶3). Export at 2× (1800 × 2700) is allowed; scale artwork proportionally. |
| **Layout** | **68%** diagram (left) / **32%** concept-card column (right). Minimum bank width **220px** at desktop breakpoints. |
| **Concept card width** | **258px** target (matches ~32% of 900px artboard; typical in-app bank ~258–270px at max content width) |
| **Concept card height** | **52px** target (single-line GCSE label) |
| **Concept card max height** | **72px** (two-line prompts) |
| **Card gap** | **8px** vertical between stacked concept cards (desktop side-by-side layout) |
| **Drop zone width** | **320px minimum** (printed empty rectangle on the image, @ 900px artboard width) |
| **Drop zone height** | **110px minimum** (printed empty rectangle on the image, @ 900px artboard height) |
| **Drop zone sizing rule** | **All four boxes identical size** — at least 320×110; large enough for the longest concept-card label to fit inside after placement |
| **Drop zone vertical spacing** | **≥140px** between box tops (four stacked boxes on portrait artboard) |
| **Right matching rail** | **68% / 32%** preferred; may expand to **~36%** artboard width if needed to fit 320px-wide boxes |
| **Drop zone labels** | **A, B, C, D** only — no numeric 1–4 on the image |
| **Drop zone count** | **4** |
| **Background** | **White** |
| **Style** | **GCSE AQA LetsRevise** — thick black outlines, minimal colour, large readable text, no decorative clutter, copyright-free |

---

## Measured reference (from codebase analysis, June 2026)

These values document **what exists today**. Phase 1 does not change them.

### Layout grid (desktop ≥768px)

- Worksheet: `data-ddm-diagram-layout="side-by-side-v1"` (`dragDropDiagramWorksheetLayout.css`)
- Columns: `minmax(0, 68%) minmax(220px, 32%)`, gap **12px 14px**
- Student content max width: **880px** (`--ds-content-max`)
- Typical right-hand bank width: **~258–270px** (32% of ~844px inner worksheet width)

### Concept cards (application-rendered)

- CSS: `.drag-drop-match__card`, `.drag-drop-match__card--tti-prompt` (`dragDropMatchBlock.css`)
- Width: **100%** of bank column (~258–270px desktop)
- Padding: **12px × 14px**; border-radius **14px**
- Height: **content-driven** — observed **~46–52px** one line, **~64–76px** two lines
- Stack gap in TTI main side-by-side: **8px**

### Printed drop rectangles (image asset)

- **Minimum standard (June 2026):** **320 × 110 px** @ 900×1350 artboard (**35.6% × 8.1%** of artboard)
- All four boxes **identical** width and height
- Each box must fit the **longest concept-card prompt** when a student drops it — no text overflowing above or below the printed rectangle
- **≥140px** vertical gap between box tops when four boxes are stacked
- Prefer **68% / 32%** layout; right rail may expand to **~36%** if 320px boxes require it
- Legacy reference (superseded): `reflex-arc-drag-drop-match-portrait.svg` used **232 × 76** — too small for in-box placement at display scale

### Interactive overlay (HTML — runtime, not artwork)

- Text-to-image main uses **runtime rectangular** drop-zone overlays (dotted borders, filled cards) aligned to **marker letters** and reserved blank space — **not** printed boxes in the image
- Diagram mode retains teacher-placed circular/chip markers or printed boxes (unchanged)

**Important (text-to-image):** Image prompts and Teacher Brain must **not** draw empty rectangles, dashed boxes, or answer-card shapes. Generated artwork shows **marker letters A–D only** plus clean blank white space where the app renders overlays. The app owns box size, position, dotted border, and placed-card appearance.

**Important (diagram / image-drop-zones):** Image prompts may still target **printed 320×110 minimum** rectangles when that mode requires on-image drop boxes.

---

## Text-to-image image design requirements (markers only — June 2026)

**Canonical rule:** The **application owns the drop boxes**. The generated image must **not** draw hard-line answer boxes. The image shows **only large A, B, C, D labels** (or 1–4) centred where the app’s dotted targets will appear, with clean white space around each label. One source of truth for the target box — the app, not the image.

Use this block in Teacher Brain / generator / image prompts for **text-to-image main image** mode. Implemented in `formatTextToImageImageDesignRequirements()` (`lib/teacherBrain/dragDropVisualContract.js`).

```text
IMAGE DESIGN REQUIREMENTS

Drop-zone ownership (text-to-image):
The application owns the drop boxes. The generated image must NOT draw hard-line answer boxes.
Do NOT draw answer rectangles or hard-line drop boxes inside the image. The application will render the dotted target boxes. Only place large A, B, C, D labels centred at the intended drop-zone positions.
Leave clean white space around each A–D label so the app's dotted target box can sit over it.
No duplicate boxes. No hard-line rectangles. No answer text inside the image. Concept cards are rendered by the application.

Artboard:
900 × 1350 portrait

Layout:
68% diagram (left) — pathway or labelled structures
32% right functional matching rail (not a decorative panel)
A, B, C, D vertically stacked in the right functional rail on the 900×1350 artboard
Each letter centred where the application drop target will appear
Do not draw borders around A–D

Markers:
Four marker letters only: A, B, C, D (or 1, 2, 3, 4 — not both)

MUST NOT draw:
- Hard-line answer rectangles or drop boxes
- Empty answer boxes
- Printed target rectangles
- Drop-zone outlines (dotted boxes are app-rendered)
- Answer-card shapes
- Concept card text

Reserved blank space (per marker):
156 × 76 px on 600×600 display (.display.png)
234 × 114 px on 900×1350 portrait artboard
Centre X: 70.25% (421.5 px on 600×600)
Marker Y (A/B/C/D): 25.42% / 47.17% / 67.83% / 88.75%
~62 px minimum vertical gap between reserved overlay areas

Alignment:
Each A–D marker shares the same horizontal centreline as its matching structure on the left
Leave clean white space around each label for the app's dotted target box

Rules:
- White background; GCSE AQA LetsRevise style
- Runtime application owns all drop-zone rectangles, dotted borders, and placed cards

Before finalising:
- Confirm NO hard-line answer rectangles or printed drop boxes
- Confirm dotted target boxes are NOT in the image (app-rendered only)
- Confirm only large A–D labels, centred at drop-zone positions
- Check that each marker aligns horizontally with its matching structure
```

---

## Diagram image design requirements (printed boxes — legacy brief block)

Use this block in Teacher Brain / generator / image prompts. **Do not** embed concept-card answer text inside the image.

```text
IMAGE DESIGN REQUIREMENTS

Artboard:
900 × 1350 portrait

Layout:
68% diagram (left) — pathway or labelled structures
32% right functional matching rail (not a decorative panel)

Drop zones:
4

Drop zone size:
320 × 110 px minimum (empty rectangles, labels only)
All four drop boxes MUST be identical in size
Each box MUST be large enough to contain the longest concept card text when placed — no overflow above or below the box
Do not stretch boxes to different heights

Vertical spacing:
At least 140 px between drop box tops (four stacked boxes)

Right rail:
Prefer 68% diagram / 32% matching rail
If 320 px-wide boxes do not fit in 32%, expand the right rail slightly (up to ~36% of artboard width)

Labels:
A, B, C, D

Alignment:
Strict vertical alignment — each box must share the same horizontal centreline as its matching structure on the left
Example (reflex arc): A ↔ sensory neurone; B ↔ relay neurone; C ↔ motor neurone; D ↔ effector
Students should be able to visually connect each labelled structure to its matching A–D box without ambiguity

Rules:
- White background
- GCSE AQA LetsRevise style — thick black outlines, minimal colour, large readable text
- No answer text inside drop rectangles
- No concept cards inside the image — concept cards are rendered separately by the application
- Portrait orientation; pathway flows top-to-bottom where applicable

Before finalising the image:
- Check that A aligns to sensory neurone (or matching structure 1)
- Check that B aligns to relay neurone (or matching structure 2)
- Check that C aligns to motor neurone (or matching structure 3)
- Check that D aligns to effector (or matching structure 4)
```

---

## What this contract does not change

Phase 1 is **documentation only**. Do not modify as part of this contract:

| Area | Files (examples) |
|------|------------------|
| Renderer | `DragDropMatchBlock.tsx` |
| Styles | `dragDropMatchBlock.css`, `dragDropDiagramWorksheetLayout.css`, `dragDropTextToImageLayout.css` |
| Editor | `EditLessonPage.tsx`, `DragDropMatchDiagramAuthoring.tsx` |
| Save / persistence | `dragDropMatchDiagram.ts`, `backend/routes/lessons.js` |
| Upload | `backend/routes/uploads.js`, Supabase storage helpers |
| Teacher Brain (until Phase 2) | `lib/teacherBrain/diagramBriefInjector.js`, `dragDropActivityLayout.js` |

---

## Phased rollout

| Phase | Action |
|-------|--------|
| **1 (now)** | Freeze this document. No code. |
| **2** | Update Teacher Brain / generator / `imagePrompt` text only to emit `IMAGE DESIGN REQUIREMENTS` from this contract. |
| **3 (optional, later)** | Align overlay markers or default zone % to artwork — only if explicitly approved; not required for image/brief alignment. |

---

## Related modes (reference only)

| Mode | Layout notes |
|------|----------------|
| **Text-to-image main** (`block.imageUrl` + `--tti-main`) | **Markers-only** contract applies (no printed boxes). Side-by-side 68/32. Runtime overlays own drop zones. |
| **Text-to-image per-pair** (`tti-grid`) | Same 68/32 column split; left column shows per-pair target images (different image height caps). Concept card sizes still follow this contract. |
| **Diagram drop zones** | Same worksheet grid; diagram mode overlay markers unchanged. New artwork should use **320×110 minimum** printed boxes when applicable. |
| **Standard text match** | No activity image; this contract does not apply. |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-01 | Initial freeze from measured CSS + reflex portrait SVG analysis. Documentation-only commit. |
| 2026-06-01 | Prompt refinement: functional right rail, strict horizontal alignment, box sizing discipline, pre-delivery checklist. |
| 2026-06-01 | Enlarge printed drop boxes to **320×110 px minimum** so dropped concept-card text fits inside printed rectangles at display scale. |
| 2026-06-08 | **Text-to-image:** switch image-generation contract to **markers only** — no printed empty rectangles; app owns runtime drop-zone overlays (`formatTextToImageImageDesignRequirements`). Diagram mode retains printed-box brief. |
| 2026-06-08 | **Text-to-image:** explicit rule — no hard-line answer boxes; only large A–D centred at drop positions; app renders dotted targets; white space around each label. |
