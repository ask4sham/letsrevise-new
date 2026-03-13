/**
 * Step 16: Build full asset manifest for human review.
 * Lists ALL supported assets with exists status and prompts.
 * No image generation. No routes. No integration.
 */

const fs = require("fs");
const path = require("path");

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

const ASSET_PROMPTS = {
  microscope:
    "Clean GCSE biology diagram of a light microscope, flat educational style, white background, blue-grey palette, simple classroom illustration, no labels, no watermark",
  "microscope-panel":
    "Educational biology panel showing microscope views and micrograph examples, clean GCSE style, white background, flat illustration, no watermark",
  "magnification-formula":
    "Clean GCSE biology formula graphic showing Magnification = Image Size / Actual Size, educational style, white background, clear typography",
  "iam-triangle":
    "Clean GCSE biology IAM triangle graphic showing I, A, and M in an equation triangle, flat educational style, white background",
  "plant-cell":
    "Clean GCSE biology plant cell diagram, flat educational style, white background, simple colored organelles, no watermark",
  "ruler-plant-cell":
    "Clean GCSE biology diagram of a plant cell beside a ruler for measurement, flat educational style, white background, no watermark",
  "root-hair-cell":
    "Clean GCSE biology root hair cell diagram, educational style, white background, flat illustration, no watermark",
  "root-hair-ruler":
    "Clean GCSE biology diagram of a root hair cell with ruler measurement, flat educational style, white background, no watermark",
  "generic-cell":
    "Clean GCSE biology cell diagram, flat educational style, white background, simple classroom illustration, no watermark",
};

const ALL_ASSET_KEYS = [
  "microscope",
  "microscope-panel",
  "magnification-formula",
  "iam-triangle",
  "plant-cell",
  "ruler-plant-cell",
  "root-hair-cell",
  "root-hair-ruler",
  "generic-cell",
];

/**
 * Check if asset file exists in assets/.
 */
function assetExists(assetKey) {
  const filename = ASSET_FILENAME_MAP[assetKey];
  if (!filename) return false;
  const fullPath = path.join(ASSETS_DIR, filename);
  try {
    return fs.existsSync(fullPath);
  } catch {
    return false;
  }
}

/**
 * Build full asset manifest for human review.
 * @param {Object} renderPackage - output of renderManim()
 * @returns {{ assets: Array<{ assetKey, expectedFilename, exists, prompt }>, metadata }}
 */
function buildAssetManifest(renderPackage) {
  const metadata = renderPackage?.metadata || {};

  const assets = ALL_ASSET_KEYS.map((assetKey) => {
    const expectedFilename = ASSET_FILENAME_MAP[assetKey] || `${assetKey}.png`;
    const exists = assetExists(assetKey);
    const prompt =
      ASSET_PROMPTS[assetKey] ||
      `Clean GCSE biology educational diagram for ${assetKey}, flat style, white background, no watermark`;

    return {
      assetKey,
      expectedFilename,
      exists,
      prompt,
    };
  });

  return {
    assets,
    metadata,
  };
}

module.exports = buildAssetManifest;
