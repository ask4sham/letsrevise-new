# Text-to-Image Drag-and-Drop v1 FINAL

**Status:** Locked recovery point — no further UI changes on this version.  
**Tag:** `text-to-image-ddm-v1-final`  
**Prior safety tags:** `text-to-image-ddm-v1-locked`, `text-to-image-ddm-stable-v1`, `drag-drop-text-to-image-v1-stable`

---

## Summary

Text-to-image main-image mode (`matchMode: textToImage`, `block.imageUrl`, four pairs) renders a side-by-side worksheet: diagram with **marker letters A–D** on the right rail (no printed empty rectangles in the image), concept cards on the right. Students drag or tap-to-place concept cards into **runtime rectangular overlay zones** aligned to marker positions and reserved blank space. After **Check answers**, correct placements show green filled cards with a magnifier; grading and explanations use persisted pair data.

---

## Final architecture

```
┌─────────────────────────────────────────────────────────────┐
│  DragDropMatchBlock (matchMode: text-to-image + imageUrl)   │
├──────────────────────────┬──────────────────────────────────┤
│  Diagram panel (72%)     │  Concept bank (28%)              │
│  ┌────────────────────┐  │  ┌────────────────────────────┐  │
│  │ .display.png img   │  │  │ Draggable concept cards    │  │
│  │ + overlay zones    │  │  │ (pair.prompt)              │  │
│  │   (runtime only)   │  │  └────────────────────────────┘  │
│  └────────────────────┘  │                                  │
│  CORRECT LABELS table    │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

| Layer | File(s) | Role |
|-------|---------|------|
| Mode detection | `DragDropMatchBlock.tsx`, `dragDropMatchDiagram.ts` | `textToImageMainMode` when `matchMode` + `block.imageUrl` |
| Zone coordinates | `dragDropMatchDiagram.ts` | Runtime `buildTextToImageMainDropZones` — **not persisted** |
| Render + DnD | `DragDropMatchBlock.tsx` | Placements in React state; click/drag handlers |
| Layout CSS | `dragDropDiagramWorksheetLayout.css` | Desktop 72/28 side-by-side; mobile stack |
| Box overlay CSS | `dragDropMatchBlock.css` | `--tti-boxed-w/h`, filled expansion, 8px Y nudge |
| Magnifier | `TtiPlacedAnswerMagnify.tsx` | Post-check correct boxes only |
| Display image | `assetUrl.ts`, `DragDropMatchBlock.tsx` | Main `<img>` uses `.display.png`; lightbox uses full-res |
| Persist | `dragDropMatchDiagram.ts` | `buildDragDropMatchBlockForPersist` strips `dropZones` for TTI |
| Teacher Brain | `lib/teacherBrain/dragDropVisualContract.js` | **Markers-only** image design requirements in TTI generation prompts (`formatTextToImageImageDesignRequirements`) |

---

## Teacher Brain contract requirements

Teacher Brain injects **IMAGE DESIGN REQUIREMENTS** from `formatTextToImageImageDesignRequirements()` when layout is `textToImage`. The frozen artboard spec lives in [`DRAG_DROP_VISUAL_CONTRACT.md`](./DRAG_DROP_VISUAL_CONTRACT.md).

Key requirements for generated/uploaded main images:

| Requirement | Value |
|-------------|--------|
| Artboard | **900 × 1350** portrait (2∶3); 2× export OK |
| Printed boxes | **MUST NOT** appear in the image — no empty rectangles, dashed boxes, or outlines |
| Markers | **A, B, C, D** only (or 1–4 if numeric — not both) |
| Reserved blank space (display) | **156 × 76 px** per marker @ 600×600 `.display.png` |
| Marker spacing | ~**62 px** minimum between reserved overlay areas |
| Layout in artwork | Diagram left (~68%), matching rail right (~32%) |
| Background | White; GCSE AQA LetsRevise style |
| Drop-zone UI | **Runtime only** — app draws rectangles, dotted borders, filled cards |

Renderer overlay coordinates are calibrated separately for **600×600 `.display.png`** (see below). New artwork should place marker letters and reserve blank space so runtime zones align after upload normalization. Pre-v1 assets with printed boxes may carry `ttiBoxGeometryVersion: "legacy"`.

---

## Image dimensions standard

| Asset | Size | Usage |
|-------|------|--------|
| **Full-res upload** | e.g. 1024×1536, 1800×2700 | Persisted `block.imageUrl`; lightbox zoom |
| **Display sibling** | **600×600** (`*.display.png`) | Student main worksheet `<img>` — `contain`, top-aligned (`lessonPngDisplay.js`) |
| **Overlay layout key** | `square-display` | Inferred from `.display.png` URL or 1∶1 natural dimensions |

**Critical:** Main worksheet rendering uses **display URL** so overlay percentages match the 600×600 artboard. Full-res is used only for lightbox (`imgLightboxSrc` via `resolveUploadedDiagramImageSrc`).

---

## Box sizing standard (runtime — not persisted)

Constants in `dragDropMatchDiagram.ts` for **square-display** (Reflex Arc reference):

| Property | Hit target (empty) | Filled visual |
|----------|-------------------|---------------|
| Center X | **70.25%** (all boxes) | unchanged |
| Center Y | A **25.92**, B **48.08**, C **70.08**, D **91.08** | unchanged |
| Width | **21.67%** | **× 1.32** (~28.6%) |
| Height | **10.33%** | **× 1.16** (~12%) |
| Filled Y nudge | — | **`translate(-50%, calc(-50% + 8px))`** — clears marker letters when filled |

Portrait full-res images use alternate centers (`TTI_CONTRACT_PORTRAIT_*`) when natural aspect ≈ 900∶1350.

CSS variables `--tti-boxed-w` / `--tti-boxed-h` are set on the overlay from `ttiBoxedZoneSizePct()`.

---

## Persistence flow

1. **Save:** `buildDragDropMatchBlockForPersist` writes `matchMode: textToImage`, `dragDropLayout: textToImage`, `imageUrl`, `pairs[]`. **`dropZones` omitted** for text-to-image.
2. **Upload:** Backend creates `name.display.png` (600×600) alongside full-res PNG; original URL unchanged in lesson JSON.
3. **Reload:** `resolveDragDropPersistMode` / `dragDropMatchModeFromBlockForProps` restore `text-to-image` from `matchMode` or `dragDropLayout`.
4. **Student render:** Zones rebuilt at runtime from pair count + layout detection — placements reset on layout/image change (`layoutResetKey`).
5. **Grading:** Compares `placements[zone.id]` to `zone.correctPairId`; explanations from `mergeDiagramZoneExplanation(zone, pair)`.

---

## Modal behaviour (magnifier)

- **When:** After **Check answers**, only on **correct** green filled boxes (`TtiPlacedAnswerMagnify`).
- **Trigger:** 🔍 icon (top-right inside box); ESC / backdrop / Close dismisses.
- **Content (in order):**
  1. **Concept card** — exact `pair.prompt` from placed card (verbatim, not truncated)
  2. **Answer** — `correctPair.answer`
  3. **Explanation** — zone or pair explanation
- **Does not change:** box size, coordinates, layout, or DnD.

---

## Verified checklist (v1 final)

- [x] Image persistence (`imageUrl` + `.display.png` sibling)
- [x] Refresh persistence (mode + image reload; zones re-inferred)
- [x] Teacher Brain contract injection (`dragDropVisualContract.js`)
- [x] Rectangular drop zones (not circular markers)
- [x] Concept cards fit inside printed boxes
- [x] Magnifier modal on correct placements
- [x] Concept card text in modal
- [x] Answer text in modal
- [x] Explanation in modal
- [x] Grading (check answers + feedback)
- [x] A/B/C/D printed labels visible (8px filled Y nudge)

---

## Known limitations

| Limitation | Notes |
|------------|--------|
| **Four pairs only** for boxed layout | Other counts fall back to auto grid zones |
| **Coordinates not persisted** | Re-calibrated in code; artwork must match contract + display pipeline |
| **Display vs full-res** | Misalignment if main `<img>` ever switched to full-res without updating layout |
| **Long prompts in box** | 2-line clamp in filled box; full text in magnifier modal |
| **Per-pair TTI mode** | Separate layout (`tti-grid`); not covered by this main-image spec |
| **Custom teacher-placed zones** | Ignored for TTI persist path; diagram mode only |

---

## Recovery tag

To restore this exact implementation:

```bash
git checkout text-to-image-ddm-v1-final
```

Or compare any future drag-and-drop work against this tag and [`TEXT_TO_IMAGE_DDM_V1_FINAL.md`](./TEXT_TO_IMAGE_DDM_V1_FINAL.md).

**Do not modify v1 visual behaviour** without a new version tag and explicit sign-off.
