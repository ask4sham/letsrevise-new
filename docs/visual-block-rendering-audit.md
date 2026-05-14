# Visual block rendering audit (Phase 6)

**Scope:** Read-only audit of **letsrevise-new** on branch context **layout-audit-phase1**.  
**Out of scope:** No code, CSS, or component refactors were performed for this document.

**Purpose:** Explain how “visual” lesson blocks are rendered today, why the UI can still feel **text-card-heavy**, and how future work might be phased.

---

## 1. Current visual block types

Canonical block types (see `frontend/src/types/lessonBlocks.ts`) that carry diagrams, sequences, interaction, or match visuals:

| Persisted / API-facing type | Product label (typical) | Role |
|----------------------------|-------------------------|------|
| `diagram` | Diagram (concept) | Catalogue visual (`visualId`) and/or annotations + step mode; or **uploaded raster** (`imageUrl`) |
| `interactiveSequence` | Step-by-step diagram (process) | Multi-step process: title, intro, per-step image + description + optional “Test me” |
| `interactiveDiagram` | Interactive diagram | Base image + placed hotspot markers + side panel (explanation + optional “Test me” MCQ) |
| `dragDropMatch` | Drag and drop match | Text rows **or** diagram mode: background image + drop zones + draggable answer cards (optional answer thumbnails) |

**Additional “visual” surfaces (not separate block types):**

- **Markdown images** inside `text` / `keyIdea` / etc.: `![](url)` rendered via shared markdown components (`lessonMarkdownViewComponents.tsx` uses `LessonImageFrame` for `<img>`).
- **V12 markdown media split:** first standalone `![](url)` in a text-like block can split into a text + image layout (`StudentMarkdownMediaSplit.tsx`).
- **HTML in markdown:** Inline/block HTML via markdown pipeline (e.g. `<table>`, `<div>`) uses generic `div`/`section` styling in view components — **no dedicated “comparison block” type**; comparisons are usually prose + optional HTML table inside a **text** shell.

---

## 2. Renderer / component map

### Student routing (premium student view)

| Concern | Primary file(s) |
|--------|-------------------|
| Block → component switch | `frontend/src/components/lesson/student/LessonStudentBlockRenderer.tsx` |
| V12 section chunk layout (split / stack / text-only) | `frontend/src/components/lesson/student/LessonStudentChunk.tsx` |
| Chunk **boundaries** (what ends a teaching unit) | `frontend/src/components/lesson/student/chunkLessonSegments.ts` — `chunkBlocksForTeachingLayout` |
| Chunk **layout classification** | `frontend/src/components/lesson/student/chunkTeachingLayout.ts` — `classifyChunkTeachingLayout` |
| Text-like blocks | `frontend/src/components/lesson/student/studentLessonBlocks.tsx` → `LessonStudentMarkdown.tsx` |

### Diagram (`type === "diagram"`)

| Concern | Primary file(s) |
|--------|-------------------|
| Student: delegates to parent | `LessonStudentBlockRenderer.tsx` wraps `renderDiagramBlock` in `.lesson-student-diagram-slot` |
| Implementation | `frontend/src/pages/LessonViewPage.tsx` — `renderDiagramBlock` + inline `DiagramBlockContent` (duplicated pattern in `ClassroomModePage.tsx`) |
| Catalogue shell | `LessonDiagramFrame.tsx` + `lessonDiagramFrame.css` |
| Image chrome / lightbox | `LessonImageFrame.tsx` + `lessonImageCard.css` |

### Step-by-step process (`interactiveSequence`)

| Concern | Primary file(s) |
|--------|-------------------|
| Component | `frontend/src/components/lesson/InteractiveSequenceBlock.tsx` + `interactiveSequenceBlock.css` |
| Editor presets note | `frontend/src/components/lesson/interactiveSequenceTemplates.ts` |

### Interactive diagram (`interactiveDiagram`)

| Concern | Primary file(s) |
|--------|-------------------|
| Component | `frontend/src/components/lesson/InteractiveDiagramBlock.tsx` + `interactiveDiagramBlock.css` |

### Drag / drop visual (`dragDropMatch`)

| Concern | Primary file(s) |
|--------|-------------------|
| Component | `frontend/src/components/lesson/DragDropMatchBlock.tsx` + `dragDropMatchBlock.css` |
| Diagram zone math | `frontend/src/utils/dragDropMatchDiagram.ts` |

### Uploaded diagram image (still `diagram` block)

Raster path in `renderDiagramBlock`: renders `.lesson-uploaded-diagram` with `<img>` + optional caption — **does not** use `LessonDiagramFrame` / `DiagramBlockContent` in that branch (`LessonViewPage.tsx`).

### Comparison / table-style content

| Concern | Primary file(s) |
|--------|-------------------|
| Rendered as markdown/HTML inside text shells | Same pipeline as other blocks: `LessonStudentMarkdown` → `LessonMarkdown` + merged `components` from `lessonMarkdownViewComponents.tsx` (custom `img`, `p`, `div`, `section`; tables fall through unless extended elsewhere). |

### Global student shell styling (reference only — not edited)

| File | Relevance |
|------|-----------|
| `frontend/src/components/lesson/student/lessonStudentView.css` | V12 rules for `.lesson-student-section-chunk*`, `.lesson-student-diagram-slot`, `.student-block--*`, diagram slot flattening |

---

## 3. How each type currently displays

### 3.1 `diagram` (catalogue / vector path)

1. `DiagramBlockContent` fetches visual by `visualId` + `level`, resolves image `src`.
2. Loading / error states are still wrapped in **`LessonDiagramFrame`** (text-centred status lines).
3. Success: **`LessonDiagramFrame`** → **`LessonImageFrame` variant `primary`** → image; optional SVG overlay for annotations / step-reveal; optional **Previous / Next** strip under the image when `mode === "step"` and multiple steps.
4. **Uploaded raster** (`imageUrl`): `renderDiagramBlock` short-circuits to a flat `.lesson-uploaded-diagram` image + caption (no `LessonDiagramFrame` in that branch).

### 3.2 `interactiveSequence` (step-by-step)

- Outer region with keyboard nav.
- **Title** (`h3`) + optional **intro** (`<p>`).
- Two internal “cards”: **media card** (`LessonImageFrame` + step image or placeholder copy) and **body card** (step counter, step title, long description paragraph, optional reveal / `AssessmentFeedback`).
- Step strip / navigation controls below (see remainder of file — pattern is “cards + text body”).

### 3.3 `interactiveDiagram`

- **Title** + **intro** as plain heading + paragraph.
- **Layout:** image area (`LessonImageFrame` + image + hotspot buttons) + **`aside`** panel.
- Panel shows `AssessmentFeedback` when a hotspot is selected; empty state copy when none selected; optional AI “Test me” MCQ stack.

### 3.4 `dragDropMatch`

- **Title**, **intro**, **instructions** (string-driven).
- **Text mode:** row-based prompts and drop targets (assessment chrome).
- **Diagram mode:** large diagram area (`LessonImageFrame` on background) + zones + bank of draggable cards (text ± small thumbnails).

### 3.5 Markdown / split images in text blocks

- Images: `<figure class="lesson-image-card-figure">` + **`LessonImageFrame` variant `secondary`** (lighter “inline” hierarchy than primary diagrams).
- V12: `StudentMarkdownMediaSplit` can place copy and first image in a split row (classes on wrapper per block type).

### 3.6 Page-level “Visual” box (`renderVisualBox` in `LessonViewPage.tsx`)

- Separate from block types: when `visualData` provides `staticDiagram`, a bordered “Visual” box with header row + `LessonImageFrame` + optional comma-separated labels line — reads like an **annotated card**, not a full-bleed figure.

---

## 4. Why visual teaching still feels “text-card-like”

### 4.1 Shared visual language = “card stack”

- **`LessonImageFrame`** is explicitly documented as a **lesson image card** (padding, elevation, lightbox affordance). Interactive diagram, sequence media, drag-drop diagram, and catalogue diagrams all lean on this **same card primitive**.
- **Text blocks** use **`student-block` + `lesson-content`** shells with similar bordered, padded surfaces (see `lessonStudentView.css` references in repo).
- Net effect: **diagrams and paragraphs share one visual family** — the eye reads “another card” rather than “stage / canvas / board”.

### 4.2 V12 chunk layout only “splits” for `diagram`, not other visual types

- `chunkBlocksForTeachingLayout` **ends a chunk** after `diagram`, `interactiveSequence`, or `interactiveDiagram`.
- **`classifyChunkTeachingLayout`** only counts **`type === "diagram"`** when deciding split vs text-only vs image-only (`isDiagramType`).
- Therefore a chunk such as **`[text, interactiveDiagram]`** or **`[keyIdea, interactiveSequence]`** contains **zero** diagram blocks → layout mode **`text-only`** → those interactive visuals render inside the **narrow text column** wrapper (`LessonStudentChunk` → `lesson-student-section-chunk--text-only` → `__text-column`).
- **Practical impact:** interactive sequence / hotspot blocks often **inherit reading-column width and “text section” chrome**, which strongly reinforces a **document / flashcard** feel even when the block is image-heavy.

### 4.3 `dragDropMatch` is not a chunk terminator

- `chunkBlocksForTeachingLayout` does **not** flush the segment on `dragDropMatch`.
- A match activity stays in the same accumulated segment as neighbouring explanation blocks until a diagram / interactive block / section-start rule fires. Large **stack** chunks mix teaching prose and complex interaction in one vertical **card column**.

### 4.4 Raster `diagram` forces **stack**, not split

- If a `diagram` block has a renderable **`imageUrl`**, `classifyChunkTeachingLayout` forces **`stack`** for the whole chunk (by design: uploaded diagrams need full width, not the slim split-column media slot).
- That is correct for layout, but it means **more full-width stacked cards** and fewer “figure dominates viewport” moments.

### 4.5 Component-internal copy density

- **Interactive diagram:** default panel text (“Select a hotspot…”) + `AssessmentFeedback` scaffolding + optional MCQ — **a lot of vertical text beside the image**.
- **Interactive sequence:** step description is a **single `<p>`** with full paragraph flow; “Test me” adds another card.
- **Hotspot labels** on the image are compact letters; the **semantic teaching text lives off-image** → brain reads **text column first**.

### 4.6 Catalogue diagram annotations

- Labels are **absolutely positioned bubbles** with `whiteSpace: nowrap` and `ellipsis` — great for cleanliness, but they **do not read as a board-wide labelled diagram** when label text is long; the **caption strip** is still prose-first.

### 4.7 No first-class “comparison layout”

- Side-by-side compare layouts depend on authors embedding HTML tables or multiple markdown images; there is **no block type** whose renderer is optimised for **A vs B** visual panels — so comparisons default to **tabular text** inside the same cardy markdown shell.

---

## 5. Low-risk improvements (future work — design / small presentation only)

These are **conceptually** lower risk because they localise presentation or metadata without changing persisted lesson schema:

- **Teach-layout parity:** Extend **`classifyChunkTeachingLayout`** (or chunk grouping) so **`interactiveSequence` / `interactiveDiagram`** participate in **`stack`** / **full-width** (or dedicated **`visual-interactive`**) wrappers instead of falling through **`text-only`** when paired with prose.
- **Optional wrapper class** on `#block-{idx}` children from `LessonStudentBlockRenderer` per routed type (e.g. `data-block-visual="interactive"`) — **purely** for scoped layout overrides later, without changing content.
- **Copy / density tweaks** in empty states (shorter panel prompts; “board instruction” tone) — still strings, but improves perceived visual-first flow.
- **Generator / author guidance** (outside this repo’s code if desired): shorter intros, fewer long paragraphs in `interactiveSequence.description`, so the **image column wins** within existing markup.

---

## 6. High-risk improvements

- **New persisted block types** or reshaping block JSON (migration, editor, API, import/export).
- **Replacing `LessonImageFrame`** as the universal diagram primitive — touches lightbox, broken-image behaviour, student + editor + classroom paths.
- **Process-flow canvas** (custom drawing engine, accessibility, print/export).
- **Auto-rechunking** lessons at runtime in a way that changes reading order or screen-reader order.
- **Table / HTML sanitisation** changes for richer comparison markup — security and cross-client consistency.

---

## 7. Proposed future phases (product / engineering roadmap)

| Phase | Goal | Notes |
|-------|------|--------|
| **P7 — Process-flow canvas** | Dedicated renderer for arrows / stages / swimlanes without raster-only dependency | High engineering + a11y cost; may coexist with `interactiveSequence` initially |
| **P8 — Visual-first diagram cards** | Differentiate **“board figure”** shell from **“reading card”** (`student-block`) — layout tokens, aspect treatment, optional full-bleed within main column | Mostly presentation; must not break editor parity |
| **P9 — Compact hotspot instructions** | Collapse intro + panel scaffolding on small viewports; optional “focus mode” image-first | Lower risk if progressive enhancement |
| **P10 — Comparison panel layout** | First-class renderer for 2-column compare (or reuse a constrained grid) instead of raw `<table>` in markdown | Could start as optional convention in `text` HTML with a stable wrapper class |
| **P11 — Image + explanation split blocks** | Generalise beyond markdown split: structured fields for “visual + short gloss” with predictable DOM for CSS | Touches authoring UI + persistence unless purely client-side heuristics |

---

## Appendix: Key code references (for implementers)

- Student block switch: `frontend/src/components/lesson/student/LessonStudentBlockRenderer.tsx`
- Chunk end rules: `frontend/src/components/lesson/student/chunkLessonSegments.ts` (`chunkBlocksForTeachingLayout`)
- Split vs text-only logic: `frontend/src/components/lesson/student/chunkTeachingLayout.ts` (`classifyChunkTeachingLayout`, `isDiagramType`)
- Diagram rendering: `frontend/src/pages/LessonViewPage.tsx` (`DiagramBlockContent`, `renderDiagramBlock`)
- Image card primitive: `frontend/src/components/lesson/LessonImageFrame.tsx`

---

*End of audit document.*
