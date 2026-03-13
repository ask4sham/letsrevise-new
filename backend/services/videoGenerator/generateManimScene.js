/**
 * Step 9 + 11A + 11C + 11D + 12 + 14: Generate Manim Python scene file from render package.
 * - Step 9: basic scene generation
 * - Step 11A: text wrapping, layout, simple visual placeholders
 * - Step 11C: white background, black text, improved placeholder visibility
 * - Step 11D: softer placeholders (no harsh borders, light fills)
 * - Step 12: use real local PNG assets when present, else placeholder fallback
 * - Step 14: GCSE explainer typography, layout, full asset support, no debug captions
 * Writes a .py file to outputs/. Does NOT run Manim.
 */

const fs = require("fs");
const path = require("path");

const OUTPUTS_DIR = path.join(__dirname, "outputs");
const ASSETS_DIR = path.join(__dirname, "assets");
const ASSET_FILENAME_MAP = {
  microscope: "microscope.png",
  "microscope-panel": "microscope-panel.png",
  "magnification-formula": "magnification-formula.png",
  "iam-triangle": "iam-triangle.png",
  "plant-cell": "plant-cell.png",
  "ruler-plant-cell": "ruler-plant-cell.png",
  "root-hair-cell": "root-hair-cell.png",
  "root-hair-ruler": "root-hair-ruler.png",
  "generic-cell": "generic-cell.png",
};
const FONT = '"Arial"';
const TITLE_FONT_SIZE = 34;
const BODY_FONT_SIZE = 24;
const MAX_CHARS_PER_LINE = 42;
const SPLIT_TEXT_WIDTH = 5.5;
const SPLIT_IMAGE_WIDTH = 4;
const FORMULA_IMAGE_WIDTH = 7;
const TRIANGLE_IMAGE_WIDTH = 4.5;
const FULL_TEXT_WIDTH = 10;

/**
 * Wrap text to max chars per line, preserve paragraph breaks.
 */
function wrapText(str, maxCharsPerLine = MAX_CHARS_PER_LINE) {
  if (!str || typeof str !== "string") return "";
  const paragraphs = str.split(/\n\n+/);
  return paragraphs
    .map((p) => {
      const words = p.trim().split(/\s+/);
      const lines = [];
      let current = "";
      for (const w of words) {
        if (current && (current + " " + w).length > maxCharsPerLine) {
          lines.push(current);
          current = w;
        } else {
          current = current ? current + " " + w : w;
        }
      }
      if (current) lines.push(current);
      return lines.join("\n");
    })
    .join("\n\n");
}

/**
 * Escape string for Python double-quoted literal.
 */
function escapeForPython(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

/**
 * Resolve asset path for assetKey. Returns absolute path if file exists, null otherwise.
 */
function resolveAssetPath(assetKey) {
  const filename = ASSET_FILENAME_MAP[assetKey];
  if (!filename) return null;
  const assetPath = path.join(ASSETS_DIR, filename);
  try {
    if (fs.existsSync(assetPath)) return path.resolve(assetPath);
  } catch (_) {}
  return null;
}

/**
 * Escape file path for Python string (backslashes, quotes).
 */
function escapePathForPython(filePath) {
  if (!filePath || typeof filePath !== "string") return "";
  return filePath.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Get image width for layout type.
 */
function getImageWidthForLayout(layout) {
  if (layout === "formula-center") return FORMULA_IMAGE_WIDTH;
  if (layout === "triangle-center") return TRIANGLE_IMAGE_WIDTH;
  return SPLIT_IMAGE_WIDTH;
}

/**
 * Emit Python code for ImageMobject when asset exists. No debug captions (Step 14).
 * Returns array of lines or null. imageWidth varies by layout.
 */
function imageLines(assetKey, imageWidth = SPLIT_IMAGE_WIDTH) {
  const assetPath = resolveAssetPath(assetKey);
  if (!assetPath) return null;
  const pyPath = escapePathForPython(assetPath);
  return [
    `place = ImageMobject("${pyPath}")`,
    `place.scale_to_fit_width(${imageWidth}).to_edge(RIGHT)`,
  ];
}

/**
 * Emit Python code for placeholder based on assetKey.
 */
function placeholderLines(assetKey) {
  if (!assetKey || assetKey === "none") return [];

  const common = (rectLabel) => [
    `rect = RoundedRectangle(corner_radius=0.12, width=3, height=2, stroke_opacity=0, fill_color=GREY_D, fill_opacity=0.35).to_edge(RIGHT)`,
    `label = Text("${rectLabel}", font_size=20, font=${FONT}, color=BLACK).next_to(rect, DOWN)`,
    "place = VGroup(rect, label)",
  ];

  switch (assetKey) {
    case "microscope":
    case "microscope-panel":
      return common("Microscope");
    case "magnification-formula":
      return [
        `place = Text("Magnification = Image / Actual", font_size=24, font=${FONT}, color=BLACK)`,
        "place.scale_to_fit_width(6).to_edge(RIGHT)",
      ];
    case "iam-triangle":
      return [
        "tri = Triangle(color=GREY_B, stroke_width=1.5).scale(0.8).to_edge(RIGHT)",
        "tri.set_fill(GREY_C, opacity=0.25)",
        `lab_i = Text("I", font_size=22, font=${FONT}, color=BLACK).next_to(tri.get_top(), UP, buff=0.2)`,
        `lab_a = Text("A", font_size=22, font=${FONT}, color=BLACK).next_to(tri.get_bottom(), DOWN, buff=0.2)`,
        `lab_m = Text("M", font_size=22, font=${FONT}, color=BLACK).next_to(tri.get_right(), RIGHT, buff=0.2)`,
        "place = VGroup(tri, lab_i, lab_a, lab_m)",
      ];
    case "generic-cell":
    case "plant-cell":
    case "ruler-plant-cell":
    case "root-hair-cell":
    case "root-hair-ruler":
      return common("Cell");
    default:
      return [];
  }
}

/**
 * Get asset lines: real image if available, else placeholder. Uses layout for image width.
 */
function getAssetLines(assetKey, layout) {
  const imageWidth = getImageWidthForLayout(layout);
  return imageLines(assetKey, imageWidth) || placeholderLines(assetKey);
}

/**
 * Emit Python lines for one scene based on layout and assetKey.
 */
function emitSceneLines(scene, i, indent = "        ") {
  const lines = [];
  const narration = String(scene.narration || "").trim();
  const title = String(scene.title || scene.id || `Scene ${i + 1}`).trim();
  const duration = Math.max(1, Math.floor(scene.duration || 2));
  const layout = scene.layout || "full-text";
  const assetKey = scene.assetKey || "none";

  const wrappedNarration = escapeForPython(wrapText(narration, MAX_CHARS_PER_LINE));
  const escapedTitle = escapeForPython(title);
  const assetLines = getAssetLines(assetKey, layout);
  const hasAsset = assetLines.length > 0;

  if (i > 0) {
    lines.push("self.clear()");
    lines.push("");
  }

  lines.push(`# Scene ${i + 1}: ${escapedTitle}`);

  if (layout === "full-text") {
    lines.push(`title = Text("${escapedTitle}", font_size=${TITLE_FONT_SIZE}, font=${FONT}, color=BLACK).to_edge(UP, buff=0.4)`);
    lines.push(`text = Text("${wrappedNarration}", font_size=${BODY_FONT_SIZE}, font=${FONT}, color=BLACK)`);
    lines.push(`text.scale_to_fit_width(${FULL_TEXT_WIDTH}).next_to(title, DOWN, buff=0.5)`);
    lines.push("self.play(FadeIn(title), FadeIn(text))");
  } else if (layout === "formula-center") {
    lines.push(`title = Text("${escapedTitle}", font_size=${TITLE_FONT_SIZE}, font=${FONT}, color=BLACK).to_edge(UP, buff=0.4)`);
    lines.push("self.play(FadeIn(title))");
    lines.push(`text = Text("${wrappedNarration}", font_size=${BODY_FONT_SIZE}, font=${FONT}, color=BLACK)`);
    lines.push(`text.scale_to_fit_width(${SPLIT_TEXT_WIDTH}).to_edge(LEFT).next_to(title, DOWN, buff=0.4)`);
    lines.push("self.play(FadeIn(text))");
    if (hasAsset) {
      assetLines.forEach((l) => lines.push(l));
      lines.push("self.play(FadeIn(place))");
    }
  } else if (layout === "triangle-center") {
    lines.push(`title = Text("${escapedTitle}", font_size=${TITLE_FONT_SIZE}, font=${FONT}, color=BLACK).to_edge(UP, buff=0.4)`);
    lines.push("self.play(FadeIn(title))");
    lines.push(`text = Text("${wrappedNarration}", font_size=${BODY_FONT_SIZE}, font=${FONT}, color=BLACK)`);
    lines.push(`text.scale_to_fit_width(${SPLIT_TEXT_WIDTH}).to_edge(LEFT).next_to(title, DOWN, buff=0.4)`);
    lines.push("self.play(FadeIn(text))");
    const triLines = getAssetLines(assetKey === "none" ? "iam-triangle" : assetKey, layout);
    triLines.forEach((l) => lines.push(l));
    lines.push("self.play(FadeIn(place))");
  } else if (layout === "split-left-text-right-image") {
    lines.push(`title = Text("${escapedTitle}", font_size=${TITLE_FONT_SIZE}, font=${FONT}, color=BLACK).to_corner(UL, buff=0.5)`);
    lines.push("self.play(FadeIn(title))");
    lines.push(`text = Text("${wrappedNarration}", font_size=${BODY_FONT_SIZE}, font=${FONT}, color=BLACK)`);
    lines.push(`text.scale_to_fit_width(${SPLIT_TEXT_WIDTH}).to_edge(LEFT).next_to(title, DOWN, buff=0.3)`);
    lines.push("self.play(FadeIn(text))");
    if (hasAsset) {
      assetLines.forEach((l) => lines.push(l));
      lines.push("self.play(FadeIn(place))");
    }
  } else {
    lines.push(`text = Text("${wrappedNarration}", font_size=${BODY_FONT_SIZE}, font=${FONT}, color=BLACK)`);
    lines.push(`text.scale_to_fit_width(${FULL_TEXT_WIDTH})`);
    lines.push("self.play(FadeIn(text))");
  }

  lines.push(`self.wait(${duration})`);
  return lines.map((l) => indent + l);
}

/**
 * Generate Manim Python scene source from render package.
 */
function generateManimScene(renderPackage) {
  const spec = renderPackage?.renderSpec || {};
  const basename = spec.outputBasename || "lesson-video";
  const filename = `${basename}.py`;
  const scenes = spec.scenes || [];

  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

  const lines = [
    "from manim import *",
    "config.background_color = WHITE",
    "",
    "class LessonScene(Scene):",
    "    def construct(self):",
    "",
  ];

  for (let i = 0; i < scenes.length; i++) {
    const sceneLines = emitSceneLines(scenes[i], i);
    lines.push(...sceneLines);
    lines.push("");
  }

  const pySource = lines.join("\n");
  const outputPath = path.join(OUTPUTS_DIR, filename);
  fs.writeFileSync(outputPath, pySource, "utf8");

  return { ok: true, outputPath, filename };
}

module.exports = generateManimScene;
