/**
 * Resolve relative asset URLs (e.g. /uploads/ai-diagrams/xyz.png) to absolute.
 * Assets are served from API host root, NOT under /api — so we must never produce .../api/uploads/...
 */
export function makeAbsoluteAssetUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // API host only (no /api) — uploads live at host/uploads/...
  const apiHost =
    (process.env.REACT_APP_API_HOST || "").replace(/\/$/, "") ||
    window.location.origin.replace(/:3000$/, ":5000"); // safe local fallback

  const path = url.startsWith("/") ? url : `/${url}`;
  // If path ever starts with /api/, strip it so we don't produce .../api/uploads/...
  const normalized = path.startsWith("/api/") ? path.slice(4) : path;

  return `${apiHost}${normalized}`;
}
