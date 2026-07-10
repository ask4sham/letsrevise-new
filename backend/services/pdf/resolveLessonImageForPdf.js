/**
 * Local-first image path resolution for lesson revision pack PDF embedding.
 * Never throws for bad URLs — returns null so callers can fall back to caption text.
 */
const fs = require("fs");
const path = require("path");
const { FILE_STORAGE_PATH, PUBLIC_VISUALS_DIR } = require("../../config/paths");

const MAX_DIAGRAMS = 8;
const IMAGE_MAX_HEIGHT = 260;
const SUPPORTED_EXT = new Set([".png", ".jpg", ".jpeg"]);

function normalizeUrl(raw) {
  if (raw == null) return "";
  let s = String(raw).trim();
  if (!s) return "";
  try {
    if (s.includes("%")) s = decodeURIComponent(s);
  } catch {
    /* keep original */
  }
  return s;
}

/**
 * Reject path traversal and absolute escapes outside allowed roots.
 * @param {string} root
 * @param {string} relative
 * @returns {string|null}
 */
function safeJoinUnderRoot(root, relative) {
  if (!root || !relative) return null;
  const cleaned = String(relative)
    .replace(/^[/\\]+/, "")
    .replace(/\\/g, "/");
  if (!cleaned || cleaned.includes("..") || path.isAbsolute(cleaned)) return null;
  const abs = path.resolve(root, cleaned);
  const rootAbs = path.resolve(root);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) return null;
  return abs;
}

function extensionOf(filePathOrUrl) {
  const base = String(filePathOrUrl || "").split("?")[0].split("#")[0];
  return path.extname(base).toLowerCase();
}

function isSupportedRaster(filePathOrUrl) {
  return SUPPORTED_EXT.has(extensionOf(filePathOrUrl));
}

/**
 * Map a lesson imageUrl to a local filesystem path when possible.
 * Supports:
 * - /visuals/... → PUBLIC_VISUALS_DIR
 * - /uploads/... → FILE_STORAGE_PATH
 * - visuals/... or uploads/... (relative)
 * - absolute local paths already under those roots (tests)
 * Absolute http(s) URLs are not fetched in this pass (return null).
 *
 * @param {string|null|undefined} imageUrl
 * @param {{ visualsDir?: string, uploadsDir?: string }} [opts]
 * @returns {string|null} absolute path or null
 */
function resolveLessonImageForPdf(imageUrl, opts = {}) {
  const raw = normalizeUrl(imageUrl);
  if (!raw) return null;

  // Never follow remote URLs in this pass (no network in PDF render).
  if (/^https?:\/\//i.test(raw) || /^\/\//.test(raw)) return null;
  if (/^(javascript|data|vbscript):/i.test(raw)) return null;

  const visualsDir = opts.visualsDir || PUBLIC_VISUALS_DIR;
  const uploadsDir = opts.uploadsDir || FILE_STORAGE_PATH;

  // Absolute local path (tests / explicit fixtures) — only if under allowed roots or opts allow.
  if (path.isAbsolute(raw) || /^[a-zA-Z]:[\\/]/.test(raw)) {
    const abs = path.resolve(raw);
    if (!isSupportedRaster(abs)) return null;
    try {
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
    } catch {
      return null;
    }
    return null;
  }

  let pathname = raw.startsWith("/") ? raw : `/${raw}`;
  // Strip accidental /api prefix
  if (pathname.startsWith("/api/")) pathname = pathname.slice(4);

  let candidate = null;
  if (pathname.startsWith("/visuals/")) {
    candidate = safeJoinUnderRoot(visualsDir, pathname.slice("/visuals/".length));
  } else if (pathname.startsWith("/uploads/")) {
    candidate = safeJoinUnderRoot(uploadsDir, pathname.slice("/uploads/".length));
  } else if (pathname.startsWith("/content/")) {
    // content/ is sometimes used for static assets under public; try visuals sibling public/content if present
    const publicRoot = path.dirname(visualsDir);
    candidate = safeJoinUnderRoot(path.join(publicRoot, "content"), pathname.slice("/content/".length));
  }

  if (!candidate) return null;
  if (!isSupportedRaster(candidate)) return null;

  try {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  } catch {
    return null;
  }
  return null;
}

module.exports = {
  resolveLessonImageForPdf,
  safeJoinUnderRoot,
  isSupportedRaster,
  MAX_DIAGRAMS,
  IMAGE_MAX_HEIGHT,
  SUPPORTED_EXT,
};
