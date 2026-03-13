/**
 * Step 15: Save missing asset prompts JSON to outputs/.
 * No routes. No DB. No integration.
 */

const fs = require("fs");
const path = require("path");

const OUTPUTS_DIR = path.join(__dirname, "outputs");

/**
 * Save prompt package (output of generateAssetPrompts) as JSON into outputs/.
 * Filename: <outputBasename>-missing-assets.json
 * @param {Object} promptPackage - { missingAssets, metadata }
 * @param {string} [outputBasename] - from renderSpec.outputBasename, default "lesson-video"
 * @returns {{ ok: boolean, outputPath: string, filename: string } | null }
 */
function saveAssetPrompts(promptPackage, outputBasename) {
  const basename = (outputBasename || "lesson-video").trim() || "lesson-video";
  const filename = `${basename}-missing-assets.json`;
  const outputPath = path.join(OUTPUTS_DIR, filename);

  if (!fs.existsSync(OUTPUTS_DIR)) {
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(promptPackage, null, 2), "utf8");

  return {
    ok: true,
    outputPath,
    filename,
  };
}

module.exports = saveAssetPrompts;
