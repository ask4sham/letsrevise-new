/**
 * Media URL service — canonical place for asset URL construction.
 * Use when inserting uploaded media into lesson markdown. See `docs/URL_AND_ENV.md` (asset vs API URLs).
 *
 * Relative `/uploads/...` paths are resolved against the **same origin as the SPA**
 * (`getAssetBaseUrl` → `window.location.origin` in the browser). That matches:
 * - CRA + setupProxy (dev): `/uploads/*` → backend :5000
 * - Netlify/production: redirects proxy `/uploads/*` to the backend (see netlify.toml)
 *
 * Full `http(s)://` URLs (R2, Supabase, Render, etc.) are left unchanged by callers that
 * already store absolute URLs.
 *
 * Future: can be extended for S3, R2, Supabase Storage without changing callers.
 */
import { getAssetBaseUrl, makeAbsoluteAssetUrl } from "../utils/assetUrl";

export { getAssetBaseUrl };

/**
 * Convert a relative asset path to an absolute URL.
 * Use at upload-insert time so markdown stores canonical URLs.
 * - Full URLs (https://...r2.dev/..., Render, etc.): pass through unchanged
 * - Relative /uploads, /visuals, /content: resolved via `makeAbsoluteAssetUrl` (same-origin + Netlify/CDN rules)
 */
export function toAbsoluteAssetUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const p = path.startsWith("/") ? path : `/${path}`;
  return makeAbsoluteAssetUrl(p) ?? path;
}

/**
 * Base for turning relative upload paths (e.g. `/uploads/...`) into absolute display URLs.
 * Delegates to `getAssetBaseUrl()` so upload previews match lesson markdown asset resolution
 * (same origin in the browser; SSR falls back to Render like `getAssetBaseUrl`).
 */
export function getUploadBaseUrl(): string {
  return getAssetBaseUrl();
}
