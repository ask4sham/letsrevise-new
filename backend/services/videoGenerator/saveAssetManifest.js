/**
 * Step 16: Save asset manifest JSON to outputs/.
 * No routes. No DB. No integration.
 */

const fs = require("fs");
const path = require("path");

const OUTPUTS_DIR = path.join(__dirname, "outputs");

/**
 * Save manifest package (output of buildAssetManifest) as JSON into outputs/.
 * Filename: <outputBasename>-asset-manifest.json
 * @param {Object} manifestPackage - { assets, metadata }
 * @param {string} [outputBasename] - from renderSpec.outputBasename, default "lesson-video"
 * @returns {{ ok: boolean, outputPath: string, filename: string }}
 */
function saveAssetManifest(manifestPackage, outputBasename) {
  const basename = (outputBasename || "lesson-video").trim() || "lesson-video";
  const filename = `${basename}-asset-manifest.json`;
  const outputPath = path.join(OUTPUTS_DIR, filename);

  if (!fs.existsSync(OUTPUTS_DIR)) {
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(manifestPackage, null, 2), "utf8");

  return {
    ok: true,
    outputPath,
    filename,
  };
}

module.exports = saveAssetManifest;
