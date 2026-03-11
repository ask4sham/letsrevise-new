#!/usr/bin/env node
/**
 * Copy the Manim magnification video to the visuals folder for Microscopy lessons.
 *
 * Run AFTER:
 *   manim -pqh magnification_gcse_external_images.py MagnificationGCSEExternalImages
 *
 * This copies the output MP4 to:
 *   backend/public/visuals/biology/aqa-gcse/cell-biology/cell-structure/magnification.mp4
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

// Manim outputs to media/videos/<module>/<quality>/<ClassName>.mp4
const possibleSources = [
  path.join(root, "media", "videos", "magnification_gcse_external_images", "1080p60", "MagnificationGCSEExternalImages.mp4"),
  path.join(root, "media", "videos", "magnification_gcse_external_images", "720p30", "MagnificationGCSEExternalImages.mp4"),
  path.join(root, "media", "videos", "magnification_gcse_external_images", "480p15", "MagnificationGCSEExternalImages.mp4"),
  // Fallback: alternate Manim script output
  path.join(root, "media", "videos", "magnification_gcse", "1080p60", "MagnificationGCSE.mp4"),
  path.join(root, "media", "videos", "magnification_gcse_all_in_one", "1080p60", "MagnificationGCSEAllInOne.mp4"),
];

const destDir = path.join(root, "backend", "public", "visuals", "biology", "aqa-gcse", "cell-biology", "cell-structure");
const destPath = path.join(destDir, "magnification.mp4");

let copied = false;
for (const src of possibleSources) {
  if (fs.existsSync(src)) {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, destPath);
    console.log("✅ Copied magnification video to:", destPath);
    copied = true;
    break;
  }
}

if (!copied) {
  console.error("❌ Magnification video not found. Run first:");
  console.error("   manim -pqh magnification_gcse_external_images.py MagnificationGCSEExternalImages");
  console.error("\nExpected output at one of:");
  possibleSources.forEach((p) => console.error("  -", p));
  process.exit(1);
}
