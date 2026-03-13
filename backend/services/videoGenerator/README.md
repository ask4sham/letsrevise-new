# GCSE Video Generator (Scaffold)

**Status:** Isolated, non-breaking scaffold. No integration yet.

## Purpose

This folder contains the future pipeline for generating GCSE lesson videos. It is intentionally isolated from all existing lesson, upload, preview, quiz, and routing code.

## What This Is

- A **placeholder scaffold** for a future video generator
- **Zero integration** with current backend or frontend
- **No routes**, **no API**, **no UI** added
- **No dependency changes** to package.json

## Structure

```
videoGenerator/
├── templates/
│   └── microscopyMagnification.js   # Step 4: Microscopy → Magnification mapper
├── assets/        # Sample lesson JSON, future images/audio/fonts
│   └── sampleMicroscopyLesson.json   # Step 8: sample input for test harness
├── outputs/       # Future: rendered videos
├── buildScript.js      # Step 2: lesson → narration
├── buildStoryboard.js  # Step 3: narration → timed scenes
├── renderManim.js     # Step 5: render package builder (no Manim invocation)
├── testPipeline.js    # Step 6: local test harness
├── saveRenderPackage.js  # Step 7: save JSON snapshot to outputs/
├── index.js           # Exports
└── README.md
```

## Pipeline (Future)

1. **buildScript** — Turn lesson content into narration text (Step 2: read-only script builder)
2. **buildStoryboard** — Turn narration into timed scenes (Step 3)
3. **renderManim** — Run Manim to produce MP4 video

### Step 2: buildScript (Implemented)

`buildScript` accepts a lesson-like object `{ title, description, subject, topic, blocks }` and produces a structured narration: `{ narration, sections: [{ key, title, text }], metadata }`. It strips video markdown, image markdown, upload links, and heading syntax. Section 1 = intro from title + description; remaining sections = one per text block. Safe, read-only, no DB or routes.

### Step 3: buildStoryboard (Implemented)

`buildStoryboard` accepts buildScript output and produces timed scenes: `{ scenes: [{ id, kind, title, text, start, end, duration, visualHint }], metadata }`. One scene per section, duration from word count, sequential timing. Safe, read-only.

### Step 4: Template mapper (Implemented)

`mapMicroscopyMagnificationStoryboard` maps buildStoryboard output to a Manim-ready structure for **Microscopy → Magnification Calculations**. Adds `layout`, `assetKey`, `animationHint` per scene based on `visualHint` and `kind`. First isolated lesson template. No routes, no Manim invocation.

### Step 5: renderManim (Implemented)

`renderManim` builds a non-rendering Manim render package from mapped template output. Produces `renderSpec` with engine, outputBasename, assets, scenes. Does NOT invoke Manim, write files, or use child_process.

### Step 6: Test harness (Implemented)

Run the full pipeline locally:

```bash
node backend/services/videoGenerator/testPipeline.js
```

Runs buildScript → buildStoryboard → mapMicroscopyMagnificationStoryboard → renderManim on sample Microscopy data and prints the final JSON. No routes, no DB, no Manim. Exports `runTestPipeline()` for reuse.

### Step 7: saveRenderPackage (Implemented)

Running the test harness now also saves a JSON snapshot of the final render package into `outputs/`. Filename: `{outputBasename}.json` (e.g. `microscopy-magnification-calculations.json`). Uses built-in `fs`/`path` only. No routes, no DB, no MP4 generation.

### Step 8: Sample lesson from disk (Implemented)

The sample Microscopy lesson now lives in `assets/sampleMicroscopyLesson.json`. The test harness loads lesson input from disk using `fs` + `path`, parses the JSON, and passes it through the pipeline. Edit the JSON to test different lesson content. No routes, no DB, no frontend integration.

### Step 9: Manim scene file generator (Implemented)

`generateManimScene(renderPackage)` converts the render package JSON into a Manim Python script and writes it to `outputs/{outputBasename}.py`. Each scene produces `Text("<narration>")`, `FadeIn`, and `wait(duration)`. The test harness calls it after saving the JSON. Does NOT run Manim yet.

### Step 11A: Text wrapping and visual placeholders (Implemented)

Generated Manim scenes now wrap long text (max 38 chars per line, paragraph breaks preserved), use `font_size` and `scale_to_fit_width` so text fits on screen, and add simple visual placeholders based on `layout` and `assetKey`: microscope (Rectangle + label), magnification-formula (Text formula), iam-triangle (Triangle + I/A/M labels), generic-cell (Circle + label). Layouts: full-text (centered), formula-center (title + text + optional placeholder), triangle-center (title + text left + triangle right), split-left-text-right-image (text left + placeholder right). No external image files. Manim is still not run automatically.

### Step 11D: Softer placeholders (Implemented)

Placeholders use a softer visual style: microscope uses `RoundedRectangle` with no stroke and light grey fill; generic-cell uses `Circle` with no stroke and soft blue fill; triangle keeps a lighter outline (`GREY_B`) for clarity; formula remains plain text with no border.

### Step 12: Real local PNG assets (Implemented)

When PNG files exist in `assets/`, the pipeline uses `ImageMobject` instead of placeholder shapes. Asset mapping: `microscope` → `microscope.png`, `generic-cell` → `generic-cell.png`, `magnification-formula` → `magnification-formula.png`, `iam-triangle` → `iam-triangle.png`. If a file is missing, the placeholder fallback is used. No auto-download, no new dependencies.

### Step 13: Fixed microscopy storyboard (Implemented)

The Microscopy template now uses a fixed 11-scene SaveMyExams-style storyboard instead of mapping one scene per lesson block. Scenes cover: title, cells intro, micrograph examples, formula, IAM triangle, worked example (plant cell), ruler measurement, worked answer, exam-style question (root hair), exam answer, summary. Input scenes are ignored; durations and narration are fixed. New asset keys: `microscope-panel`, `plant-cell`, `ruler-plant-cell`, `root-hair-cell`, `root-hair-ruler`.

### Step 14: GCSE explainer layout and typography (Implemented)

The renderer respects the fixed microscopy storyboard, uses Arial font for titles (34) and body (24), left-aligned text, and layout-specific image scaling. Full asset support for all Step 13 keys (including microscope-panel, plant-cell, ruler-plant-cell, root-hair-cell, root-hair-ruler). Debug captions removed. Placeholder fallback when PNGs are missing.

### Step 15: Missing asset prompt generator (Implemented)

The pipeline detects which asset PNGs are missing in `assets/` and generates clean AI-image prompts for them. Output saved to `outputs/<outputBasename>-missing-assets.json`. Prompt-generation only; no image generation, no API calls, no new dependencies.

### Step 16: Asset manifest for review (Implemented)

The pipeline produces a full asset manifest listing every supported asset, whether it exists, expected filename, and the prompt to use if missing. Saved to `outputs/<outputBasename>-asset-manifest.json` for human review.

**Rerun the pipeline and render manually:**

```bash
node backend/services/videoGenerator/testPipeline.js
manim -pqh backend/services/videoGenerator/outputs/microscopy-magnification-calculations.py LessonScene
```

## Usage (Future)

```js
const { buildScript, buildStoryboard, renderManim, mapMicroscopyMagnificationStoryboard } = require("./videoGenerator");

// Not wired up anywhere yet.
```

## Non-Breaking

- Does not touch upload routes
- Does not touch lesson rendering
- Does not touch quiz logic
- Does not touch frontend pages
