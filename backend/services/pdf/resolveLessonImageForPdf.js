/**
 * Local-first + allowlisted remote image resolution for lesson revision pack PDF.
 * Never throws for bad URLs — returns null so callers can fall back to caption text.
 *
 * @typedef {{ kind: 'path', path: string } | { kind: 'buffer', buffer: Buffer }} ResolvedLessonImage
 */
const fs = require("fs");
const path = require("path");
const { FILE_STORAGE_PATH, PUBLIC_VISUALS_DIR } = require("../../config/paths");

const MAX_DIAGRAMS = 8;
const IMAGE_MAX_HEIGHT = 260;
const SUPPORTED_EXT = new Set([".png", ".jpg", ".jpeg"]);
const ALLOWED_REMOTE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);
const REMOTE_TIMEOUT_MS = 8000;
const REMOTE_MAX_BYTES = 2.5 * 1024 * 1024; // 2.5 MB

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

function isBlockedHostname(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0" || h === "::1" || h === "[::1]") return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const parts = h.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  }
  return false;
}

/**
 * Strict allowlist for remote lesson media used by the app.
 * @param {string} imageUrl
 * @returns {boolean}
 */
function isAllowlistedRemoteImageUrl(imageUrl) {
  const raw = normalizeUrl(imageUrl);
  if (!/^https:\/\//i.test(raw)) return false;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (isBlockedHostname(u.hostname)) return false;
  if (String(u.pathname || "").includes("..")) return false;
  if (!isSupportedRaster(u.pathname)) return false;

  const host = u.hostname.toLowerCase();
  const pathname = u.pathname;

  // Primary: Supabase public lesson-media bucket
  if (
    (host.endsWith(".supabase.co") || host.endsWith(".supabase.in")) &&
    pathname.includes("/storage/v1/object/public/lesson-media/")
  ) {
    return true;
  }

  // Optional: R2 public hosts already used by the app for lesson/visual assets
  if (
    (host.endsWith(".r2.dev") || host.includes("r2.cloudflarestorage.com")) &&
    (pathname.includes("/lesson-media/") ||
      pathname.includes("/visuals/") ||
      pathname.includes("/uploads/"))
  ) {
    return true;
  }

  // Optional: known API hosts serving /uploads or /visuals
  if (
    (host === "letsrevise-new.onrender.com" || host === "api.letsrevise.com") &&
    (pathname.startsWith("/uploads/") || pathname.startsWith("/visuals/"))
  ) {
    return true;
  }

  return false;
}

/**
 * Sync local-only resolution (path string or null). Used by tests and as first step.
 * @param {string|null|undefined} imageUrl
 * @param {{ visualsDir?: string, uploadsDir?: string }} [opts]
 * @returns {string|null}
 */
function resolveLocalLessonImagePath(imageUrl, opts = {}) {
  const raw = normalizeUrl(imageUrl);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || /^\/\//.test(raw)) return null;
  if (/^(javascript|data|vbscript):/i.test(raw)) return null;

  const visualsDir = opts.visualsDir || PUBLIC_VISUALS_DIR;
  const uploadsDir = opts.uploadsDir || FILE_STORAGE_PATH;

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
  if (pathname.startsWith("/api/")) pathname = pathname.slice(4);

  let candidate = null;
  if (pathname.startsWith("/visuals/")) {
    candidate = safeJoinUnderRoot(visualsDir, pathname.slice("/visuals/".length));
  } else if (pathname.startsWith("/uploads/")) {
    candidate = safeJoinUnderRoot(uploadsDir, pathname.slice("/uploads/".length));
  } else if (pathname.startsWith("/content/")) {
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

/**
 * Fetch allowlisted remote PNG/JPEG into a Buffer. Never throws.
 * @param {string} imageUrl
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, maxBytes?: number }} [opts]
 * @returns {Promise<Buffer|null>}
 */
async function fetchAllowlistedRemoteImage(imageUrl, opts = {}) {
  if (!isAllowlistedRemoteImageUrl(imageUrl)) return null;

  const fetchImpl = opts.fetchImpl || global.fetch;
  if (typeof fetchImpl !== "function") return null;

  const timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : REMOTE_TIMEOUT_MS;
  const maxBytes = opts.maxBytes != null ? opts.maxBytes : REMOTE_MAX_BYTES;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer =
    controller &&
    setTimeout(() => {
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
    }, timeoutMs);

  try {
    const res = await fetchImpl(normalizeUrl(imageUrl), {
      method: "GET",
      redirect: "follow",
      signal: controller ? controller.signal : undefined,
      headers: { Accept: "image/png,image/jpeg" },
    });
    if (!res || !res.ok) return null;

    const ctype = String(res.headers?.get?.("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (ctype && !ALLOWED_REMOTE_TYPES.has(ctype)) return null;

    const lenHeader = res.headers?.get?.("content-length");
    if (lenHeader && Number(lenHeader) > maxBytes) return null;

    const ab = await res.arrayBuffer();
    if (!ab) return null;
    if (ab.byteLength <= 0 || ab.byteLength > maxBytes) return null;

    const buf = Buffer.from(ab);
    // Basic magic-byte check (PNG / JPEG)
    const isPng = buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    if (!isPng && !isJpeg) return null;
    return buf;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Resolve a lesson imageUrl to a local path or remote buffer for PDFKit.
 * Local first; then allowlisted HTTPS PNG/JPEG fetch.
 *
 * @param {string|null|undefined} imageUrl
 * @param {{ visualsDir?: string, uploadsDir?: string, fetchImpl?: typeof fetch, timeoutMs?: number, maxBytes?: number }} [opts]
 * @returns {Promise<ResolvedLessonImage|null>}
 */
async function resolveLessonImageForPdf(imageUrl, opts = {}) {
  try {
    const local = resolveLocalLessonImagePath(imageUrl, opts);
    if (local) return { kind: "path", path: local };

    const buf = await fetchAllowlistedRemoteImage(imageUrl, opts);
    if (buf) return { kind: "buffer", buffer: buf };
    return null;
  } catch {
    return null;
  }
}

module.exports = {
  resolveLessonImageForPdf,
  resolveLocalLessonImagePath,
  fetchAllowlistedRemoteImage,
  isAllowlistedRemoteImageUrl,
  safeJoinUnderRoot,
  isSupportedRaster,
  MAX_DIAGRAMS,
  IMAGE_MAX_HEIGHT,
  SUPPORTED_EXT,
  REMOTE_TIMEOUT_MS,
  REMOTE_MAX_BYTES,
};
