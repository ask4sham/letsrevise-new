/**
 * Media URL service — canonical place for asset URL construction.
 * Use when inserting uploaded media into lesson markdown.
 *
 * Local dev: http://localhost:5000/uploads/...
 * Production: https://letsrevise-new.onrender.com/uploads/...
 *
 * Future: can be extended for S3, R2, Supabase Storage without changing callers.
 */
import { getAssetBaseUrl, makeAbsoluteAssetUrl } from "../utils/assetUrl";

export { getAssetBaseUrl };

/**
 * Convert a relative asset path to an absolute URL.
 * Use at upload-insert time so markdown stores canonical URLs.
 * ALWAYS uses backend URL (Render) for /uploads, /visuals, /content — never Netlify.
 * Netlify does not serve uploaded files; backend does.
 */
export function toAbsoluteAssetUrl(path: string | null | undefined): string {
  if (!path) return "";
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p.startsWith("/uploads/") || p.startsWith("/visuals/") || p.startsWith("/content/")) {
    const base = getUploadBaseUrl();
    return `${base}${p}`;
  }
  const abs = makeAbsoluteAssetUrl(path);
  return abs ?? path;
}

/** Base URL for upload API. Production always uses Render; local dev uses getAssetBaseUrl. */
export function getUploadBaseUrl(): string {
  if (typeof window === "undefined") return "https://letsrevise-new.onrender.com";
  const isLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);
  return isLocal ? (getAssetBaseUrl() || "http://localhost:5000") : "https://letsrevise-new.onrender.com";
}
