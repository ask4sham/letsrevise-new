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
| **Phase 3** | **Image rendering foundation** — global image design tokens + minimal adoption on `lesson-image-card` only; audit map §14. |
| **Phase 4** | **Responsive layout foundation** — `:root` layout tokens + opt-in `.lr-*` utilities (see §15); **no** `@media` edits in this phase. |
| **Phase 5** | **Breakpoint consolidation (safe foundation)** — inventory + intent comments + migration plan (§16); **no** `@media` value changes. |
| **Phase 6** | **Breakpoint alignment (UI)** — unify 767 vs 768 vs 900 contracts; regression checklist for sticky rails. |
| **Phase 7** | **Image pipeline** — unify margins (`index` vs `lessonImageCard`), reduce uploaded-diagram special-case surface. |
| **Phase 8** | **Student chunk layout** — refactor `lessonStudentView.css` with lower specificity; E2E on narrow viewports. |
| **Phase 9** | **Editor / preview parity** — extract inline layout from `LessonViewPage` / `EditLessonPage` into tested layout components. |

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
- **`lessonImageCard.css`** — Phase 3: outer **card shell** uses global image tokens (§14); inner `img` sizing, `max-height`, `object-fit`, and lightbox layout unchanged.
- **`.lesson-content img`** — image sizing and margins (unchanged in Phases 2–3).
- **`lessonUploadedDiagram.css`**, **`lessonStudentView.css`**, **`lessonDiagramFrame.css`**, **`dragDropMatchBlock.css`**, **`interactiveSequenceBlock.css`**, **`interactiveDiagramBlock.css`** — diagram / drag-drop / sequence / student chunk layout.
- **`LessonViewPage.tsx`** (and other TSX) — inline layout and mobile breakpoint logic.
- **Mass replacement** of arbitrary `px` values across the codebase.

### 13.5 Future migration recommendations

1. **Extend adoption file-by-file** — next low-risk candidates: small shared utilities (e.g. more of `lessonRenderer.css` for values already on the 4/8/12/16 scale), then `assessmentFeedback.css` (after visual check; some values are 10px / 6px off-scale).
2. **Optional intermediate tokens** — e.g. `--space-2-5: 10px` only if several call sites need it; avoids stretching the primary scale.
3. **Radius tokens** — separate pass (`--radius-sm`, etc.) to avoid mixing spacing and shape in one migration.
4. **Storybook or visual snapshots** for checkpoint + MCQ rows before touching student or editor chrome.

---

## 14. Phase 3 — Image rendering unification foundation (implemented)

**Branch:** `layout-audit-phase1`  
**Scope:** Low-risk infrastructure — no component refactors, no drag/drop / sequence / uploaded-diagram / student layout changes, no `object-fit` / `max-height` / `aspect-ratio` edits.

### 14.1 Image rendering map (audit)

| Component / file | Where used | Image / visual type | Sizing / chrome rule (summary) | Risk if changed blindly | Safe to unify later? |
|-------------------|------------|---------------------|--------------------------------|-------------------------|----------------------|
| **`LessonImageFrame.tsx`** + **`lessonImageCard.css`** | Markdown, diagram-in-card, student blocks when wrapped | Raster in elevated card | Card `max-width` 360–460px by variant; inner `img` `max-height: min(70vh, 520px)`, `object-fit: contain`; inner radius `10px` (still literal) | **Medium** — many entry points | **Yes** — primary target once tokens prove stable |
| **`LessonLightboxPanel.tsx`** + lightbox rules in `lessonImageCard.css` | Zoom-from-card | Full-resolution | Viewport-capped stage; nav/icon **40–48px** (matches thumb token values) | **Medium** — modal/focus | **Partial** — wire to `--lesson-image-thumb-*` after visual QA |
| **`index.css` `.lesson-content img`** | Legacy lesson markdown | Inline images | `margin: 20px auto`, `max-width: 100%`, `height: auto` | **Medium** — global rhythm vs cards | **Yes** — coordinate with card margins first |
| **`LessonDiagramFrame.tsx`** + **`lessonDiagramFrame.css`** | Catalogue / structured diagrams | Content inside frame | Local `--lesson-diagram-*` vars; radius `12px`, body padding | **Medium** | **Partial** — already tokenised locally; optional bridge to global image tokens |
| **`lessonUploadedDiagram.css`** + **`LessonViewPage.tsx`** (`.lesson-uploaded-diagram`) | `diagram.imageUrl` uploads | Raster, no card chrome | `width: auto`, `max-width: 100%`, caption `margin-top: 6px` | **High** — student V12 `:has()` overrides | **Not soon** — document only until student CSS simplified |
| **`InteractiveSequenceBlock.tsx`** + `.css` | Sequence steps | Step imagery | Viewport `min-height` chains, flex | **High** | **No** (short term) |
| **`DragDropMatchBlock.tsx`** + `.css` | Diagram + pair thumbnails | Diagram + thumbs | Inline `objectFit`, class-based layout | **High** | **No** (short term) |
| **`InteractiveDiagramBlock.tsx`** + `.css` | Hotspot diagrams | Base + overlay | Hit areas, `min-height` floors | **High** | **No** (short term) |
| **`lessonMarkdownViewComponents.tsx`** | Authoring / view markdown | `<img>` + error handler | Inherits `.lesson-content` where applicable | **Medium** | **Yes** — after global margin story decided |
| **`StudentMarkdownMediaSplit.tsx`** | V12 student presentation | First-block image split | Side-by-side chunk layout | **High** | **No** until chunk layout refactored |

### 14.2 Global tokens added (`frontend/src/index.css` `:root`)

| Token | Value (initial) | Notes |
|-------|-----------------|--------|
| `--lesson-image-radius` | `14px` | Outer **`lesson-image-card`** shell only in this phase. |
| `--lesson-image-border` | `1px solid #e5e7eb` | Default card border; `--primary` still overrides `border-color`. |
| `--lesson-image-bg` | `#ffffff` | Card surface. |
| `--lesson-image-caption-gap` | `8px` | Caption separation below image. |
| `--lesson-image-thumb-size-sm` | `40px` | Reserved — matches lightbox nav small breakpoint; **not wired** in Phase 3. |
| `--lesson-image-thumb-size-md` | `44px` | Reserved — matches lightbox icon button; **not wired** in Phase 3. |
| `--lesson-image-thumb-size-lg` | `48px` | Reserved — matches lightbox nav buttons; **not wired** in Phase 3. |

**Not added to `:root` in this phase:** inner image `border-radius: 10px` (card content) — keep literal until a dedicated content-radius token is agreed (avoids overloading `--lesson-image-radius`).

### 14.3 Low-risk adoption (this phase)

| File | Change |
|------|--------|
| **`lessonImageCard.css` `.lesson-image-card`** | `border-radius`, `background`, `border` now use `var(--lesson-image-radius)`, `var(--lesson-image-bg)`, `var(--lesson-image-border)`. |
| **`lessonImageCard.css` `.lesson-image-caption`** | `margin-top: 8px` → `var(--lesson-image-caption-gap)`. |

**Unchanged in this phase:** inner `img` radius (`10px`), all `max-height` / `object-fit`, lightbox layout, diagram frames, uploads, sequence/drag-drop/interactive diagram CSS, student layout, TSX.

### 14.4 High-risk image paths — do not touch without a dedicated phase

- **`dragDropMatchBlock.css` / `.tsx`** — thumbnails, diagram sizing, `aspect-ratio` overrides.
- **`interactiveSequenceBlock.css`** — viewport-tied step imagery.
- **`lessonStudentView.css`** + **`lessonUploadedDiagram.css`** interplay — `:has(.lesson-uploaded-diagram)` and V12 slots.
- **`interactiveDiagramBlock.css`** — hotspot geometry and diagram floor heights.
- **Global `.lesson-content img` margins** — conflicts with card margins; needs a coordinated “markdown vs card” decision first.

### 14.5 Future safe migration steps

1. Introduce **`--lesson-image-radius-inner`** (or reuse a shared radius scale) for the **10px** inner `img` / lightbox `12px` corners — migrate only with screenshot diff.
2. Wire **lightbox** `44px` / `48px` / `40px` controls to `--lesson-image-thumb-size-*` after confirming no touch-target regressions on mobile.
3. Align **`LessonDiagramFrame`** local vars with global image tokens where values intentionally match (optional bridge, not merge).
4. **Markdown vs card** — single story for vertical margin (`index` `20px` vs card `20px auto 28px`) before changing either.
5. **Student split media** — last; depends on chunk layout simplification (Phase 8+ in roadmap above).

---

## 15. Phase 4 — Responsive layout consistency foundation (implemented)

**Branch:** `layout-audit-phase1`  
**Scope:** Documentation + additive CSS only — **no** changes to existing `@media` blocks, grid templates, sticky behaviour, editor/student pages, drag-drop, checkpoints, sequences, or uploaded diagrams.

### 15.1 Layout tokens (`frontend/src/index.css` `:root`)

| Token | Value | Intended meaning |
|-------|-------|------------------|
| `--layout-mobile-max` | `767px` | “Phone-first” upper bound (aligns with `LessonViewPage` `matchMedia` string). |
| `--layout-tablet-max` | `900px` | Sticky rails / teacher dashboard stack (`App.css`, `index.css` use 900 / 899). |
| `--layout-content-max` | `920px` | Narrow readable column cap (e.g. future `.lr-content-width` consumers; drag-drop uses **920px** as a **max-height** cap — different axis; do not conflate without review). |
| `--layout-wide-max` | `1200px` | Legacy “wide” shell (e.g. `App.css` patterns). |

**`@media` limitation:** standard CSS cannot write `@media (max-width: var(--layout-mobile-max))`. Keep numeric literals in `@media` until a preprocessor, duplicate custom props, or JS-driven breakpoints mirror this table. Tokens are for **`max-width` on elements**, **`calc()`**, **container queries** (where supported), and **documentation** alongside TS `matchMedia` strings.

### 15.2 Opt-in utilities (additive; **zero** current consumers)

| Class | Behaviour |
|-------|-----------|
| `.lr-min-w-0` | `min-width: 0` — flex/grid shrink guardrail for new markup. |
| `.lr-full-width` | `width: 100%` + `box-sizing: border-box`. |
| `.lr-content-width` | `max-width: var(--layout-content-max)` + centred with `margin-inline: auto`. |

### 15.3 Breakpoint audit (major values)

| Value | Typical role | Notable locations |
|-------|--------------|-------------------|
| **480px** | Small-phone tweaks | `dragDropMatchBlock.css` |
| **520px** | Lightbox nav shrink | `lessonImageCard.css` |
| **767px** | “Mobile” layout for drag-drop | `dragDropMatchBlock.css` `@media (max-width: 767px)` |
| **768px** | “At least tablet” / lesson markdown mobile | `dragDropMatchBlock.css` `(min-width: 768px)`; `App.css` `(min-width: 768px)`; **`index.css` `.lesson-content` uses `(max-width: 768px)`** — **off-by-one vs 767** |
| **≤768px** | `innerWidth` fallback | `LessonViewPage.tsx` (`<= 768` vs `matchMedia` max-width **767px**) |
| **899px** | Just below sticky threshold | `App.css` `(max-width: 899px)` pairing with 900 |
| **900px** | Sticky sidebars, dashboard stack | `App.css` `(min-width: 900px)`; `index.css` teacher dashboard `(max-width: 900px)` |
| **920px** | **Max-height** cap (not breakpoint) | `dragDropMatchBlock.css` `max-height: min(82vh, 920px)` |
| **1100px** | Create-lesson editor | `App.css` |
| **1200px** | Wide content shell | `App.css`; `EditLessonPage.tsx` default width fallback |
| **1400px** | V12 student presentation grid cap | `LessonViewPage.tsx` inline `maxWidth` |
| **1440px** | Shell caps | `App.css` |

**Consolidation plan (future, not executed in Phase 4):**  
1. Decide a **single mobile contract** (767 vs 768) for **JS + CSS** and document the one-pixel delta (`LessonViewPage` vs `index.css` lesson content).  
2. Keep **900 / 899** as a pair until rails logic moves to a shared constant in JS or comments only.  
3. Introduce optional **`--layout-breakpoint-mobile-em: 48em`** style only if `rem`-based breakpoints are adopted app-wide.

### 15.4 Mobile / responsive risks (documentation)

- **Fixed-width cards** — `lesson-image-card` variants (360–460px) centre on small screens but are not full-bleed by design.
- **Sticky sidebars** — depend on **window scroll** + `App.css` **`min-width: 900px`**; changing breakpoints without updating both sides breaks stickiness.
- **Preview panes** — Create/Edit lesson sticky preview rails share `--lesson-editor-rail-sticky-top` with lesson view.
- **Nested grids** — `LessonViewPage` desktop grid + inner flex + block-level grids.
- **`min-width: 0`** — repeated with `!important` in `lessonStudentView.css`; `#root` already has `min-width: 0` in `index.css`.
- **`overflow-x`** — `html`/`body` `overflow-x: hidden` / `clip` documented to interact with `position: sticky`; lesson content mobile block adds `overflow-x: hidden` on `.lesson-content`.

### 15.5 High-risk areas — not modified in Phase 4

- All existing **`@media`** queries and **grid `grid-template-columns`**.
- **`App.css`** lesson editor / view rail rules.
- **`LessonViewPage.tsx`**, **`EditLessonPage.tsx`**, **`CreateLessonPage.tsx`** layout and breakpoint JS.
- **`lessonStudentView.css`**, **`dragDropMatchBlock.css`**, **`interactiveSequenceBlock.css`**, checkpoints, uploaded diagrams.

### 15.6 Recommended future migration sequence

1. **Document-only** — keep Phase 4 tokens in sync when touching files; add comments referencing `--layout-*` next to literal `@media` breakpoints (optional).
2. **Opt-in utilities** — apply `.lr-min-w-0` / `.lr-full-width` to **new** wrappers first; snapshot before retrofitting hot paths.
3. **767 / 768 alignment** — choose one source of truth; update `LessonViewPage` **or** `index.css` in a dedicated PR with device QA.
4. **TS constants** — export breakpoint numbers from a small `breakpoints.ts` consumed by `matchMedia` strings **and** commented beside CSS (still duplicate literals in CSS until build tooling).

---

## 16. Phase 5 — Breakpoint consolidation (safe foundation only)

**Branch:** `layout-audit-phase1`  
**Scope:** Documentation refinement + **non-behavioural** comments in global CSS hubs (`index.css`, `App.css`) only. **No** `@media` threshold edits, no grid/sticky/student/drag-drop/sequence changes.

### 16.1 Breakpoint inventory (refined)

| Value / range | Primary purpose | Key files / surfaces | Safe to consolidate later? |
|-----------------|-----------------|----------------------|----------------------------|
| **480px** | Very small phones (drag-drop density) | `dragDropMatchBlock.css` | **Low priority** — isolated block; touch after dedicated QA. |
| **520px** | Lightbox nav control size | `lessonImageCard.css` | **Yes** — cosmetic; pair with lightbox tokens. |
| **640px** | Tailwind-style grid `sm` | `App.css` utility grid | **Yes** — utility layer only. |
| **767px** | “Phone” layout for lesson blocks + student + `matchMedia` in `LessonViewPage` | `dragDropMatchBlock.css`, `interactiveDiagramBlock.css`, `interactiveSequenceBlock.css`, `lessonStudentView.css` (multiple), `LessonViewPage.tsx` (`MOBILE_BREAKPOINT`), `EditLessonPage.tsx` (`EDIT_LESSON_NARROW_MAX_PX`) | **Careful** — canonical **mobile** candidate; must stay aligned with TS `matchMedia` when changed. |
| **768px** | “Md” grid utilities; **lesson markdown** mobile wrap; drag-drop **desktop** rules (`min-width`); **one** `lessonStudentView.css` rule | `App.css`, `index.css` (`.lesson-content`), `dragDropMatchBlock.css`, `lessonStudentView.css` (~line 1618) | **Medium risk** — **767 vs 768** is the main inconsistency; unify only in a **dedicated** Phase 6 with device matrix. |
| **899px** | **Paired** with 900: force `position: static` on rails **below** sticky threshold | `App.css` (lesson view + edit-lesson wide grid) | **Do not merge with 900** — intentional off-by-one so `min-width:900` and `max-width:899` never gap. |
| **900px** | Sticky sidebars ON; sequence **two-column** desktop; **content max-width** on some pages | `App.css`, `interactiveSequenceBlock.css`, `index.css` (teacher dashboard stack), `SettingsPage.tsx` / quiz / assessment wrappers (`maxWidth: "900px"`) | **High coordination** — sticky + dashboard + TS layout flags; change only with full regression pass. |
| **1024px** | Tailwind-style `lg` grid | `App.css` | **Yes** — utilities. |
| **1100px** | Create-lesson editor single column | `App.css` | **Yes** — editor-only; document relation to 900/899 family. |
| **1101px** | Create-lesson **sticky** preview rails (paired with 1100 stack) | `App.css` | **Yes** — keep **1100 / 1101** pair documented like 899/900. |
| **1200px** | Legacy `.container` cap | `App.css` | **Yes** — maps to `--layout-wide-max` (Phase 4). |
| **1400px** | V12 student presentation grid cap | `LessonViewPage.tsx` inline | **Later** — presentation mode specific. |
| **1440px** | Editor / shell max width | `App.css` (`edit-lesson-editor-column`, create shell) | **Later** — editor chrome. |

**767 vs 768 (audit detail):**

- **`LessonViewPage`:** `matchMedia('(max-width: 767px)')` but `innerWidth <= 768` fallback — **intentional** comment in code: real-phone detection.
- **`index.css`:** `.lesson-content` uses **`max-width: 768px`** — one pixel **wider** mobile band than lesson page grid switch.
- **`lessonStudentView.css`:** mostly **767**; **one** block at **768** — candidate for typo review later, **not** changed in Phase 5.

**899 vs 900:** not duplicates — **complementary** breakpoints for sticky rail CSS.

### 16.2 Semantic comments added (CSS)

- **`index.css`** — comments above `.lesson-content` mobile `@media` and teacher-dashboard `@media`; `:root` block includes a **comment-only** example of future compiled `@media` from layout tokens.
- **`App.css`** — comments pairing **`min-width: 900px`** / **`max-width: 899px`** for lesson view and edit-lesson wide rails; **1101px** / **1100px** create-lesson pair; utility-grid note before **`min-width: 768px`** (`md` columns vs lesson 767 contract).

### 16.3 Intentionally NOT changed

- Numeric literals inside **`@media`** (except any future typo fix — none applied here).
- **`dragDropMatchBlock.css`**, **`interactiveSequenceBlock.css`**, **`interactiveDiagramBlock.css`**, **`lessonStudentView.css`** — no edits (highest layout coupling).
- **`LessonViewPage.tsx`**, **`EditLessonPage.tsx`** — no TS/logic edits.

### 16.4 Proposed canonical breakpoints (future, not enforced in CSS yet)

| Name | Suggested px | Role |
|------|--------------|------|
| `mobile-max` | **767** | Primary “phone / collapse rails” for **lesson** surfaces (align TS + most block CSS). |
| `content-mobile-max` | **768** | **Optional** second line only if we intentionally want markdown `.lesson-content` to switch one px later — otherwise **merge to 767** in Phase 6. |
| `rail-sticky-min` | **900** | Sticky sidebars + desktop sequence column split. |
| `rail-static-max` | **899** | Must remain **`stickyMin - 1`**. |
| `editor-stack-max` | **1100** | Create-lesson stack. |
| `editor-sticky-min` | **1101** | Create-lesson sticky preview; keep `stackMax + 1`. |

### 16.5 Migration order (recommended)

1. **Inventory + comments** (Phase 5 — this document + global comments).  
2. **Choose 767 vs 768** for “lesson mobile” and update **`index.css`** **or** **`LessonViewPage`** in one PR with visual QA (Phase 6).  
3. **Student `768` outlier** in `lessonStudentView.css` — verify intent; align to 767 if equivalent.  
4. **Sticky / 900 family** — last; requires sticky scroll tests on real devices.  
5. **Block-level** drag-drop/sequence — isolated passes per component.

### 16.6 High-risk responsive systems (keep isolated)

- **`App.css`** lesson + editor **900 / 899** and **1100 / 1101** pairs.  
- **`LessonViewPage.tsx`** layout branch + `matchMedia`.  
- **`lessonStudentView.css`** V12 + `!important` + `:has()`.  
- **`dragDropMatchBlock.css`** viewport heights and **767 / 768** split.

### 16.7 Future `@media` + tokens (documentation only — no preprocessor)

Example pattern if a build step later emits static CSS:

```css
/* If a tool inlines vars, generated output might look like: */
/* @media (max-width: 767px) { ... }  ← from --layout-mobile-max */
```

Until then, keep **`@media (max-width: 767px)`** literals and duplicate **`--layout-mobile-max`** in docs/TS for parity.

---

*Phase 1 audit; Phases 2–5 foundations on `layout-audit-phase1`.*
