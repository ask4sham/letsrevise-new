# Drag-and-drop visual design contract

**Status:** Frozen specification (Phase 1)  
**Scope:** Text-to-image main image (`dragDropMatch` + `block.imageUrl` + side-by-side worksheet) and shared artwork standards for Teacher Brain, generators, and image prompts.  
**Not in scope for this document:** Renderer changes, CSS changes, save/persistence, upload pipelines, or lesson data.

---

## Purpose

LetsRevise drag-and-drop and text-to-image activities depend on **aligned dimensions** between:

1. **Activity images** (printed empty drop rectangles A–D on the diagram)
2. **In-app concept cards** (right-hand panel, rendered by the application)
3. **Interactive overlay markers** (HTML hit targets on the diagram — separate from printed artwork)

When image assets are designed without these numbers, the diagram and UI fight each other (e.g. placeholders too small, inconsistent spacing, cards ~260×60–80px while image boxes do not match).

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

- Text-to-image main uses **transparent rectangular** hit targets aligned to printed boxes (not circular A–D markers)
- Diagram mode retains teacher-placed circular/ chip markers (unchanged)

**Important:** Image prompts and Teacher Brain must target **printed 320×110 minimum** rectangles. Generated artwork must not rely on the app to draw answer text inside boxes.

---

## Image design requirements (copy for Phase 2 briefs)

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
| **Text-to-image main** (`block.imageUrl` + `--tti-main`) | This contract applies. Side-by-side 68/32. |
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
