# Layout audit — Phase 1 (read-only)

**Scope:** Map the current layout and rendering system for later consistency work.  
**Branch intent:** Analysis and documentation only — no CSS, component, or behaviour changes in this phase.

**Primary codebase:** `frontend/src` (lesson player, student view, editors, global shells).

---

## 1. Executive summary

The lesson UI combines **three layout layers** that interact:

1. **Global shell** — `index.css`, `App.css` (`#root`, `.App`, overflow/sticky rules, lesson editor/view rail variables).
2. **Large page orchestrators** — especially `LessonViewPage.tsx` (inline flex/grid, breakpoints, `MOBILE_BREAKPOINT`, `1400px` cap, sticky mobile bars) plus `EditLessonPage.tsx` / `CreateLessonPage.tsx` (class-based grids tied to `App.css`).
3. **Block-level CSS** — per-feature stylesheets (`dragDropMatchBlock.css`, `interactiveSequenceBlock.css`, `lessonStudentView.css`, etc.) with many local `min-height: 0`, `overflow: hidden`, and viewport-based `min-height`/`max-height` rules.

**Image rendering** splits into: global `.lesson-content img` rules, `LessonImageFrame` + `lessonImageCard.css`, diagram shells (`LessonDiagramFrame` + `lessonDiagramFrame.css`), uploaded raster (`.lesson-uploaded-diagram` + `lessonUploadedDiagram.css`, heavily overridden in `lessonStudentView.css` for V12), and several **raw `<img>`** paths with duplicated `objectFit` / `onError` patterns.

**Highest regression risk** if refactored blindly: sticky rails + scrollport coupling (`index.css` / `App.css` comments), `LessonViewPage` grid vs mobile branch, and **drag-drop / sequence / student chunk** CSS (large files, `!important` in student view, `:has()` selectors for uploaded diagrams).

---

## 2. Methodology

- Static review: glob of `frontend/src/**/*.css`, targeted grep for `min-height`, `height: 100%`, `aspect-ratio`, `min-width: 0`, `overflow`, `sticky`, `maxWidth`, `img` / `objectFit`.
- Spot-read of key TSX/CSS: `LessonViewPage.tsx`, `LessonImageFrame.tsx`, `LessonDiagramFrame.tsx`, `LessonStudentBlockRenderer.tsx`, `index.css`, `App.css`, `lessonImageCard.css`, `lessonStudentView.css` headers/comments.

---

## 3. Spacing systems

### 3.1 Duplicated or parallel spacing sources

| Source | Notes |
|--------|--------|
| **`App.css`** | Universal reset `* { margin:0; padding:0 }` then component rules — competes with any component that expects user-agent defaults. |
| **`index.css` `.lesson-content`** | `img { margin: 20px auto }` — global rhythm for markdown images. |
| **`lessonImageCard.css`** | Card uses `margin: 20px auto 28px`, `padding: 14px` — overlaps conceptual “image vertical rhythm” with index. |
| **`LessonViewPage.tsx` inline styles** | Repeated `gap: 8`, `gap: 12`, `marginTop: 10`, flex columns — same visual rhythm re-specified many times (not tokenised). |
| **`lessonRenderer.css`** | Checkpoint shell: `padding: 14px 16px`, `border-radius: 12px`, mixed `rem` and `px`. |

**Finding:** There is **no single spacing scale** (e.g. 4/8/12); **px, rem, em, vh, and `%` mix** across globals and blocks.

### 3.2 Inconsistent margin/padding scales (examples)

- **Rem vs px:** `.lesson-renderer-section-heading` uses `margin: 1.1em 0 0.5em` vs checkpoint `14px 16px`.
- **Border radius:** `10px`, `12px`, `14px` appear across cards, MCQ rows (`index.css` `.lr-mcq-option` `10px`), image cards (`14px` / inner `10px`).

### 3.3 “Random” or one-off px values (audit samples)

- `LessonViewPage.tsx`: `maxWidth: 500` (local UI panel), `maxWidth: 720` (error/shell), `maxWidth: "1400px"` when `v12StudentPresentation`, `width: 18` for icon column.
- `interactiveSequenceBlock.css` / `dragDropMatchBlock.css`: many specific values (`52px`, `162px`, `73px`, `280px`, etc.) tied to interaction affordances.

**Finding:** Many px values are **behavioural** (touch targets, rails); others are **visual** (radii, gaps) — risk is conflating the two during a refactor.

### 3.4 Repeated spacing patterns

- **Flex column + `gap: 8` or `12`** — dominant in `LessonViewPage.tsx` inline layout.
- **`min-width: 0` repeated** — defensive flex/grid shrinking (`App.css`, `index.css`, `dragDropMatchBlock.css`, `lessonStudentView.css` with many `!important` variants).

### 3.5 `min-height` usage (risk: vertical layout coupling)

| Area | Pattern |
|------|--------|
| **`dragDropMatchBlock.css`** | Many `min-height: 0` (flex children); diagram area `min-height: 280px`, media query `min(72vh, 720px)`; touch `min-height: 44px`, `52px`. |
| **`interactiveSequenceBlock.css`** | `min-height: min(58vh, 560px)` repeated; `clamp(200px, 28vh, 360px)`; fixed `162px` / `73px` rows. |
| **`interactiveDiagramBlock.css`** | `180px`, `100px` diagram floor heights. |
| **`App.css` / `index.css`** | `min-height: 100vh` on `#root` / legacy `.App-header`. |
| **`CausalMechanismBlock.css`** | `min-height: 4.5rem`. |

**Risk:** Viewport-based `min-height` chains **fight** parent `max-height` / `overflow` (comments in `lessonImageCard.css` already acknowledge “double max-height” issues for nested overlays).

### 3.6 `height: 100%` usage

- Concentrated in **`lessonImageCard.css`** and **`dragDropMatchBlock.css`** (fill flex tracks / diagram cells).

**Risk:** `height: 100%` without a defined parent height or alongside `min-height: 0` is a classic source of **collapsed or overstretched** flex children.

### 3.7 `aspect-ratio` usage

- **`dragDropMatchBlock.css`:** `aspect-ratio: auto` and `!important` overrides — suggests **previous aspect-ratio conflicts** or browser-specific tuning.

**Finding:** `aspect-ratio` is **not** a primary layout driver globally; it appears **tactical** in drag-drop.

### 3.8 Components with potentially conflicting layout rules

- **`.lesson-content img` (global)** vs **`.lesson-image-card img` (max-height `min(70vh, 520px)`)** vs **uploaded diagram overrides** (student V12: comments explicitly mention beating **generic img max-height caps**).
- **`lessonStudentView.css`**: heavy use of **`!important`** on `min-width` / `min-height` — indicates **specificity wars** between student layout and shared/global rules.

---

## 4. Image rendering systems

### 4.1 Major paths / components (map)

| Path | Role |
|------|------|
| **`index.css` `.lesson-content img`** | Baseline: `display:block`, `margin: 20px auto`, `max-width:100%`, `height:auto` — all markdown lesson text images. |
| **`LessonImageFrame.tsx` + `lessonImageCard.css`** | Card chrome, variants (`default` / `primary` / `secondary`), lightbox hook, `lessonImageFrameImgStyle` (`objectFit: "contain"`). |
| **`LessonDiagramFrame.tsx` + `lessonDiagramFrame.css`** | Branded frame for **catalogue / structured** diagrams; docstring notes uploaded raster **does not** use this. |
| **`lessonUploadedDiagram.css` + `LessonViewPage.tsx`** | `.lesson-uploaded-diagram` markup for **uploaded** `diagram.imageUrl`. |
| **`InteractiveDiagramBlock.tsx`** | Raw `<img>` + hotspots; uses `LessonImageFrame` / `hideBrokenLessonImage` per implementation. |
| **`InteractiveSequenceBlock.tsx`** | Step images: `<img>` + error handler. |
| **`DragDropMatchBlock.tsx`** | Diagram `<img>` with `objectFit: diagramImageFit`; pair thumbnails (separate error handling — comment warns **not** to use `hideBrokenLessonImage` for those). |
| **`lessonMarkdownViewComponents.tsx`** | Markdown-rendered images. |
| **`StudentMarkdownMediaSplit.tsx`** | V12 side-by-side: splits markdown at first image; `<img>` + frame. |
| **`LessonLightboxPanel.tsx`** | Full-screen / modal image (`<img>`). |

### 4.2 Duplicated logic

- **`hideBrokenLessonImage`** — walks multiple `closest(...)` selectors (frame, diagram shell, uploaded class, `figure`) — **centralised** but **broad side effects** (hides whole shells).
- **`objectFit: contain`** — repeated in TSX inline styles and CSS (`lessonImageCard`, `lessonImageFrameImgStyle`).
- **URL resolution** — `makeAbsoluteAssetUrl`, `resolveFullResolutionImageUrlForLightbox` (lightbox); diagram/drag-drop paths also take `resolveImageUrl`-style props in places.

### 4.3 Inconsistent sizing strategies

| Strategy | Where |
|----------|--------|
| **Card max-width** | `.lesson-image-card` `420px` / `--primary` `460px` / `--secondary` `360px` — fixed caps. |
| **Max height on images** | `.lesson-image-card img`: `max-height: min(70vh, 520px)`; overlay host resets `max-height: none`. |
| **Viewport min-heights** | Sequence / drag-drop blocks — different `vh` fractions (`58vh`, `72vh`, `28vh`). |
| **Uploaded diagrams** | Separate class path + **student V12** overrides (`lessonStudentView.css` + `@import` of `lessonUploadedDiagram.css`) — **parallel system** to `LessonDiagramFrame`. |

### 4.4 Likely causes of past image spacing / scaling issues (hypothesis from code structure)

1. **Global `.lesson-content img` margins** interacting with **cards** and **grid media columns** (double spacing or unexpected centring).
2. **`max-height` on card images** vs **diagram overlays** — explicit override rules show this was a known conflict.
3. **Uploaded diagrams** not using `LessonDiagramFrame` — **two visual languages** (uploaded strip vs framed diagram) + **many `:has(.lesson-uploaded-diagram)`** rules — easy to break one viewport mode when fixing another.
4. **`hideBrokenLessonImage`** collapsing containers — can remove expected height and **shift sticky / scroll** layout.

---

## 5. Layout wrappers

### 5.1 Lesson page / student shell

- **`LessonViewPage.tsx`** — main orchestration: `data-lesson-view="structured"`, **mobile = `display:block` + `minWidth:0`**, desktop = **CSS grid** (`lesson-view-three-col`), optional `maxWidth: "1400px"` for V12 presentation, `<main minWidth:0>`.
- **Comments in file** reference **`App.css`** for sticky sidebars at `min-width: 900px` — cross-file contract.

### 5.2 Content width systems

- **Full-width shell:** comment around `maxWidth: "100%"` (no `1750/1920px` band).
- **Narrow bands:** e.g. `maxWidth: 720` for some states, `500` for specific controls.
- **Editor:** `EditLessonPage.tsx` uses **`edit-lesson-layout-shell` / `edit-lesson-layout-grid--{wide|medium|narrow}`** — width caps and tracks defined in **`App.css`** (`minmax(0, …)` patterns in comments).

### 5.3 Grid / flex wrappers

- **Student:** `lessonStudentView.css` defines chunk sections, media columns, diagram slots, presentation attribute `[data-lesson-presentation="v12"]` — **large surface area**.
- **Create lesson:** `.create-lesson-editor-grid`, sticky preview aside (`App.css`).

### 5.4 Side panels & sticky preview

- **`App.css`:** `--lesson-editor-rail-sticky-top` and `--lesson-view-rail-sticky-top` (**88px**); sticky rules for `.lesson-view-three-col` sidebars, create-lesson preview, edit-lesson rails; **`max-height: calc(100vh - …)`** on sticky columns.
- **Explicit design constraint in `App.css`:** `.app-main { overflow: visible }` — **sticky depends on window/body scroll**, not nested scrollports.

### 5.5 Nested wrappers / width conflicts / stretch issues

- **Nested grids:** lesson page grid + inner flex + block CSS grids (e.g. flashcard viewer `display:grid` in `LessonViewPage.tsx`).
- **`[data-lesson-editor="true"] [data-col="wrapper" | left | center | right]`** rules in `App.css` — another **wrapper contract** for editors.
- **`:has()` selectors** in `lessonStudentView.css` tie media column alignment to presence of uploaded diagrams — **high coupling**, easy whitespace regressions.

### 5.6 Whitespace / “mystery gap” suspects

- Collapsing margins between **global `img` margins** and **section chunk padding**.
- **Sticky rails** with `max-height` + internal `overflow` — content can **clip** or leave **visual gaps** under the header offset if `top` constants drift from actual header height.

---

## 6. Mobile responsiveness

### 6.1 Fixed widths

- Image cards: **360–460px** caps (intentionally sub-full-width on large screens; on small screens `max-width:100%` in card rules helps but **card still centres**).
- `LessonViewPage.tsx`: **500px**, **720px**, **1400px** breakpoints / caps (mixed purposes).
- **`MOBILE_BREAKPOINT = "(max-width: 767px)"`** in `LessonViewPage.tsx` vs **`900px`** media queries in `App.css` for rails — **two breakpoint families**.

### 6.2 `min-width: 0`

- Present on `#root`, `.App`, many lesson components — **good** for flex overflow.
- **`lessonStudentView.css`** repeats `min-width: 0 !important` in many selectors — suggests **ongoing flex overflow fixes**; any refactor must preserve these or replace with a single parent constraint.

### 6.3 Overflow risks

- **`index.css`:** `html`/`body` `overflow-x: hidden` / `clip` — **documented** interaction with `position: sticky`.
- **Many `overflow: hidden`** in interactive block CSS — risk of **clipped focus rings** or **toolbar truncation** on small screens if not paired with scroll or collapse rules.

### 6.4 Non-collapsing grids / desktop assumptions

- **900px** threshold for sticky rails — below that, layout stacks; assumptions baked into comments (“matches lesson view”).
- **V12 presentation** toggles `maxWidth: "1400px"` on grid — desktop-first **content theatre**.

### 6.5 Student mobile bar

- `LessonViewPage.tsx`: **compact sticky progress/navigation** — `maxWidth: "100vw"`, flex split; worth **isolated regression tests** in future phases.

---

## 7. Block architecture consistency

### 7.1 Dominant “premium student” pattern

- **`LessonStudentBlockRenderer.tsx`** routes types to **`studentLessonBlocks.tsx`** shells + interactive components (`InteractiveSequenceBlock`, `InteractiveDiagramBlock`, `DragDropMatchBlock`).
- **Checkpoint / MCQ** styling partially shared via **`lessonRenderer.css`** and **`index.css`** MCQ grid.

### 7.2 Inconsistencies

| Dimension | Observation |
|-----------|-------------|
| **Headers** | Mix of CSS classes (`.lesson-renderer-section-heading`) and inline styles in `LessonViewPage`. |
| **Padding / radius** | `12px` / `14px` / `16px` across cards and checkpoints without a single token file. |
| **Media handling** | Three tiers: markdown global img, framed card, uploaded diagram exceptions. |
| **Interaction spacing** | Drag-drop and sequence blocks use **dense** control strips vs **looser** markdown text blocks. |

### 7.3 Components that diverge from the dominant layout style

- **Uploaded diagrams** — intentionally “plain” vs **LessonDiagramFrame** chrome.
- **Drag-drop match** — largest bespoke CSS surface; behaves like a **mini-app** inside a block.
- **Editor pages** — heavy inline `style={{}}` on `EditLessonPage` (e.g. practice lane card) vs student view class-based system.

---

## 8. Risk levels (for future work)

| Item | Level | Rationale |
|------|-------|-----------|
| `App.css` sticky rail + `overflow` contract | **High** | Cross-cutting; easy to break sticky or introduce nested scroll. |
| `LessonViewPage.tsx` layout branch (mobile vs grid) | **High** | Large inline layout; breakpoint split at 767px vs 900px elsewhere. |
| `lessonStudentView.css` (`!important`, `:has`) | **High** | Specificity + structural selectors. |
| `dragDropMatchBlock.css` / `interactiveSequenceBlock.css` | **High** | Many coupled height/flex rules. |
| `index.css` `.lesson-content` global img | **Medium** | Touches all legacy markdown. |
| `lessonImageCard.css` variants | **Medium** | Well-scoped but interacts with globals. |
| `lessonRenderer.css` | **Lower** | Smaller, mostly checkpoint / heading. |

---

## 9. Recommendations (non-binding; for later phases)

1. **Introduce design tokens** (spacing, radius, breakpoints) in one place — **do not** remove `min-width:0` or sticky scrollport comments until a replacement is validated.
2. **Document breakpoint matrix** — align or consciously separate **767** (page) vs **900** (rails).
3. **Image pipeline diagram** — one internal doc: which blocks use `LessonImageFrame`, which use raw `img`, which use uploaded diagram classes.
4. **Consolidate image vertical rhythm** — decide whether markdown images use **card-only** margins or **global** margins, not both conceptsually overlapping.
5. **Reduce `!important`** in student CSS via **single wrapper** specificity (future refactor with visual regression).

---

## 10. “Safe to refactor” vs “high regression risk”

### Safe to refactor (with tests / visual checks)

- **`lessonRenderer.css`** — limited scope; mostly typography and checkpoint chrome.
- **Isolated presentational values** inside a single component file **if** no `!important` and no cross-selectors (e.g. minor radius harmonisation inside one card).

### High regression risk

- **`App.css`** lesson editor / view sticky sections.
- **`LessonViewPage.tsx`** outer layout, mobile sticky bars, grid template definitions.
- **`lessonStudentView.css`** chunk/media/diagram/V12 rules.
- **`dragDropMatchBlock.css`**, **`interactiveSequenceBlock.css`**, **`interactiveDiagramBlock.css`**.
- **`hideBrokenLessonImage` behaviour** — any change affects empty-state layout of multiple block types.

---

## 11. Proposed future phases

| Phase | Focus |
|-------|--------|
| **Phase 2** | **Spacing token foundation** — `:root` scale + minimal adoption in `index.css` / `lessonRenderer.css` (see §13). |
| **Phase 3** | **Breakpoint alignment** — document and optionally unify 767 vs 900; add regression checklist for sticky rails. |
| **Phase 4** | **Image pipeline** — unify margins (`index` vs `lessonImageCard`), reduce uploaded-diagram special-case surface (replace `:has` chains only if substitute layout is equivalent). |
| **Phase 5** | **Student chunk layout** — refactor `lessonStudentView.css` with lower specificity; pair with E2E on narrow viewports. |
| **Phase 6** | **Editor / preview parity** — extract inline layout from `LessonViewPage` / `EditLessonPage` into tested layout components. |

---

## 12. Main files reference (quick index)

**Global / shell:** `frontend/src/index.css`, `frontend/src/App.css`  
**Lesson page:** `frontend/src/pages/LessonViewPage.tsx`  
**Editors:** `frontend/src/pages/EditLessonPage.tsx`, `frontend/src/pages/CreateLessonPage.tsx`  
**Student rendering:** `frontend/src/components/lesson/student/LessonStudentBlockRenderer.tsx`, `LessonStudentChunk.tsx`, `lessonStudentView.css`, `studentLessonBlocks.tsx`, `StudentMarkdownMediaSplit.tsx`  
**Images:** `LessonImageFrame.tsx`, `lessonImageCard.css`, `LessonLightboxPanel.tsx`  
**Diagrams:** `LessonDiagramFrame.tsx`, `lessonDiagramFrame.css`, `lessonUploadedDiagram.css`  
**Interactive blocks:** `DragDropMatchBlock.tsx` + `.css`, `InteractiveSequenceBlock.tsx` + `.css`, `InteractiveDiagramBlock.tsx` + `.css`  
**Markdown / legacy content:** `lessonMarkdownViewComponents.tsx`, `lessonRenderer.css`  
**Chunking / layout logic (TS):** `chunkLessonSegments.ts`, `chunkTeachingLayout.ts` (behavioural — touch only in later phases with tests)

---

## 13. Phase 2 — Spacing token foundation (implemented)

**Branch:** `layout-audit-phase1`  
**Scope:** Infrastructure only — no layout redesign, no component structure changes, no behaviour changes.

### 13.1 Where tokens live

- **`frontend/src/index.css`** — `:root` defines the numeric scale (`--space-2xs` … `--space-2xl`) and semantic aliases used by the first adoption sites.

### 13.2 What was tokenized (literal → variable, same computed values)

| Location | Change |
|----------|--------|
| **`index.css` `.lr-mcq-option`** | `column-gap: 12px` → `var(--lesson-mcq-option-gap)`; `padding: 12px 14px` → `var(--lesson-mcq-option-padding-block)` / `var(--lesson-mcq-option-padding-inline)` (12px and 14px preserved). |
| **`lessonRenderer.css` `.lesson-renderer-checkpoint`** | `padding: 14px 16px` → `var(--lesson-card-padding)` (`14px` + `var(--space-md)`). Vertical margin left `1rem 0` (unchanged). |
| **`lessonRenderer.css` checkpoint internals** | `margin-bottom: 12px` on question/options → `var(--lesson-block-gap)`; option row `margin-bottom: 8px` → `var(--space-xs)`; reveal button `padding: 8px 14px` → `var(--space-xs) 14px`. |

### 13.3 Semantic aliases added

| Token | Role |
|-------|------|
| `--lesson-block-gap` | Repeated ~12px vertical rhythm between checkpoint subsections (`var(--space-sm)`). |
| `--lesson-card-padding` | Checkpoint / lesson “card” inner padding (`14px` + `16px` via `--space-md`). |
| `--lesson-mcq-option-gap` / `--lesson-mcq-option-padding-*` | MCQ option row gap and padding (matches previous 12px / 14px pattern). |

### 13.4 Intentionally NOT touched (Phase 2)

- **`App.css`** — sticky rails, editor grids, scrollport behaviour.
- **`lessonImageCard.css`**, **`.lesson-content img`** — image sizing and margins.
- **`lessonUploadedDiagram.css`**, **`lessonStudentView.css`**, **`lessonDiagramFrame.css`**, **`dragDropMatchBlock.css`**, **`interactiveSequenceBlock.css`**, **`interactiveDiagramBlock.css`** — diagram / drag-drop / sequence / student chunk layout.
- **`LessonViewPage.tsx`** (and other TSX) — inline layout and mobile breakpoint logic.
- **Mass replacement** of arbitrary `px` values across the codebase.

### 13.5 Future migration recommendations

1. **Extend adoption file-by-file** — next low-risk candidates: small shared utilities (e.g. more of `lessonRenderer.css` for values already on the 4/8/12/16 scale), then `assessmentFeedback.css` (after visual check; some values are 10px / 6px off-scale).
2. **Optional intermediate tokens** — e.g. `--space-2-5: 10px` only if several call sites need it; avoids stretching the primary scale.
3. **Radius tokens** — separate pass (`--radius-sm`, etc.) to avoid mixing spacing and shape in one migration.
4. **Storybook or visual snapshots** for checkpoint + MCQ rows before touching student or editor chrome.

---

*Phase 1 audit complete; Phase 2 spacing foundation documented above (`layout-audit-phase1`).*
