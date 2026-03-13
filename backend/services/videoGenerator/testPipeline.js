/**
 * Step 6: Local test harness for the videoGenerator pipeline.
 * Runs: buildScript -> buildStoryboard -> mapMicroscopyMagnificationStoryboard -> renderManim
 * Loads lesson input from assets/sampleMicroscopyLesson.json.
 * No routes. No DB. No Manim.
 */

const fs = require("fs");
const path = require("path");
const buildScript = require("./buildScript");
const buildStoryboard = require("./buildStoryboard");
const mapMicroscopyMagnificationStoryboard = require("./templates/microscopyMagnification");
const renderManim = require("./renderManim");
const saveRenderPackage = require("./saveRenderPackage");
const generateManimScene = require("./generateManimScene");
const generateAssetPrompts = require("./generateAssetPrompts");
const saveAssetPrompts = require("./saveAssetPrompts");
const buildAssetManifest = require("./buildAssetManifest");
const saveAssetManifest = require("./saveAssetManifest");
const getManimRenderCommand = require("./getManimRenderCommand");

const SAMPLE_LESSON_PATH = path.join(__dirname, "assets", "sampleMicroscopyLesson.json");

/**
 * Load sample lesson from disk.
 */
function loadSampleLesson() {
  const raw = fs.readFileSync(SAMPLE_LESSON_PATH, "utf8");
  return JSON.parse(raw);
}

/**
 * Run the full pipeline and return the final result.
 * Loads lesson from assets/sampleMicroscopyLesson.json.
 */
function runTestPipeline() {
  const lesson = loadSampleLesson();
  const script = buildScript(lesson);
  const storyboard = buildStoryboard(script);
  const mapped = mapMicroscopyMagnificationStoryboard(storyboard);
  const result = renderManim(mapped);
  return result;
}

/**
 * Run and print to console when executed directly.
 */
if (require.main === module) {
  const result = runTestPipeline();
  console.log(JSON.stringify(result, null, 2));
  const { outputPath } = saveRenderPackage(result);
  console.log("Saved render package to:", outputPath);
  const pyPath = generateManimScene(result);
  console.log("Generated Manim scene file:", pyPath);
  const outputBasename = result?.renderSpec?.outputBasename || "lesson-video";
  const promptPackage = generateAssetPrompts(result);
  if (promptPackage.missingAssets.length === 0) {
    console.log("No missing assets.");
  } else {
    const saved = saveAssetPrompts(promptPackage, outputBasename);
    console.log("Saved missing asset prompts to:", saved.outputPath);
  }
  const manifestPackage = buildAssetManifest(result);
  const manifestSaved = saveAssetManifest(manifestPackage, outputBasename);
  console.log("Saved asset manifest to:", manifestSaved.outputPath);
}

module.exports = { runTestPipeline, loadSampleLesson };
