/**
 * Step 7: Safe local snapshot writer for the videoGenerator pipeline.
 * Saves render package JSON into outputs/. No routes. No DB. No Manim.
 */

const fs = require("fs");
const path = require("path");

const OUTPUTS_DIR = path.join(__dirname, "outputs");

/**
 * Save render package (output of renderManim) as JSON into outputs/.
 * @param {Object} renderPackage - { template, renderSpec, videoPath, metadata }
 * @returns {{ ok: boolean, outputPath: string, filename: string }}
 */
function saveRenderPackage(renderPackage) {
  const basename = (renderPackage?.renderSpec?.outputBasename || "lesson-video").trim() || "lesson-video";
  const filename = `${basename}.json`;
  const outputPath = path.join(OUTPUTS_DIR, filename);

  if (!fs.existsSync(OUTPUTS_DIR)) {
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(renderPackage, null, 2), "utf8");

  return {
    ok: true,
    outputPath,
    filename,
  };
}

module.exports = saveRenderPackage;
