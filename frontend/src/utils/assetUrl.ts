/**
 * Resolve relative asset URLs (e.g. /uploads/ai-diagrams/xyz.png) to absolute.
 * Assets are served from API host root, NOT under /api — so we must never produce .../api/uploads/...
 */
export function makeAbsoluteAssetUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // API host only (no /api) — uploads/visuals/content live at host root
  const apiHost =
    (process.env.REACT_APP_API_HOST || "").replace(/\/$/, "") ||
    (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL || "")
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/api\/?$/, "") || // strip trailing /api
    (typeof window !== "undefined"
      ? window.location.origin.replace(/:3000$/, ":5000").replace(/:5173$/, ":5000")
      : "http://localhost:5000");

  const path = url.startsWith("/") ? url : `/${url}`;
  // If path ever starts with /api/, strip it so we don't produce .../api/uploads/...
  const normalized = path.startsWith("/api/") ? path.slice(4) : path;

  return `${apiHost}${normalized}`;
}
