/**
 * Normalised PNG “display” variants for lesson diagrams: fixed square canvas, aspect preserved, transparent padding.
 * Original uploads are never overwritten; a sibling file `name.display.png` is created when applicable.
 */
const sharp = require("sharp");

/** Square bounding box (px) for normalised lesson PNG display files. */
const LESSON_PNG_DISPLAY_SIZE = 600;

function isPngMime(mimetype) {
  const m = (mimetype || "").toLowerCase().split(";")[0].trim();
  return m === "image/png" || m === "image/x-png";
}

/**
 * @param {string} filename e.g. diagram-123.png
 * @returns {string|null} e.g. diagram-123.display.png, or null if not applicable
 */
function displayFilenameForPng(filename) {
  if (!filename || typeof filename !== "string") return null;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".display.png")) return null;
  if (!lower.endsWith(".png")) return null;
  return filename.replace(/\.png$/i, ".display.png");
}

/**
 * Resize into LESSON_PNG_DISPLAY_SIZE square with transparent padding; output PNG.
 * @param {Buffer} inputBuffer
 * @returns {Promise<Buffer|null>}
 */
async function createLessonPngDisplayBuffer(inputBuffer) {
  if (!Buffer.isBuffer(inputBuffer) || !inputBuffer.length) return null;
  try {
    return await sharp(inputBuffer)
      .ensureAlpha()
      .resize(LESSON_PNG_DISPLAY_SIZE, LESSON_PNG_DISPLAY_SIZE, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  } catch (e) {
    console.warn("[lessonPngDisplay] createLessonPngDisplayBuffer:", e.message);
    return null;
  }
}

module.exports = {
  LESSON_PNG_DISPLAY_SIZE,
  isPngMime,
  displayFilenameForPng,
  createLessonPngDisplayBuffer,
};
