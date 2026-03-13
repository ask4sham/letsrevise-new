/**
 * Step 5: Non-rendering render package builder.
 * Accepts mapped template output and builds a Manim render spec.
 * Does NOT invoke Manim, does NOT write files, does NOT use child_process.
 * No routes. No DB. No integration.
 */

/**
 * Slugify title for safe output basename.
 * Lowercase, letters/numbers/hyphens only. Fallback to "lesson-video".
 */
function slugifyOutputBasename(title) {
  if (!title || typeof title !== "string") return "lesson-video";
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
  return slug || "lesson-video";
}

/**
 * Extract unique asset keys from scenes, excluding "none".
 */
function collectAssets(scenes) {
  const seen = new Set();
  const assets = [];
  for (const s of scenes) {
    const key = s.assetKey;
    if (key && key !== "none" && !seen.has(key)) {
      seen.add(key);
      assets.push(key);
    }
  }
  return assets;
}

/**
 * Trim scene to fields needed for future rendering.
 */
function trimSceneForRender(scene) {
  return {
    id: scene.id,
    kind: scene.kind,
    title: scene.title,
    narration: scene.narration,
    start: scene.start,
    end: scene.end,
    duration: scene.duration,
    layout: scene.layout,
    assetKey: scene.assetKey,
    animationHint: scene.animationHint,
  };
}

/**
 * Build Manim render spec from mapped template output.
 * Does NOT invoke Manim. No file writes. No child_process.
 * @param {Object} templateOutput - { template, scenes, metadata } from mapMicroscopyMagnificationStoryboard()
 * @returns {Object} { template, renderSpec, videoPath, metadata }
 */
function renderManim(templateOutput) {
  const input = templateOutput || {};
  const template = input.template || "microscopy-magnification";
  const scenes = Array.isArray(input.scenes) ? input.scenes : [];
  const metadata = input.metadata || {};

  const title = metadata.title || "";
  const outputBasename = slugifyOutputBasename(title);

  const lastScene = scenes.length > 0 ? scenes[scenes.length - 1] : null;
  const totalDurationSeconds = lastScene ? lastScene.end : 0;

  const assets = collectAssets(scenes);
  const renderScenes = scenes.map(trimSceneForRender);

  return {
    template,
    renderSpec: {
      engine: "manim",
      version: "placeholder",
      outputBasename,
      totalDurationSeconds,
      sceneCount: scenes.length,
      assets,
      scenes: renderScenes,
    },
    videoPath: null,
    metadata,
  };
}

module.exports = renderManim;
