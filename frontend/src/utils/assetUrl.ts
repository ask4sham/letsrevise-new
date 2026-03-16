/**
 * Resolve relative asset URLs (e.g. /uploads/..., /visuals/..., /content/...) to absolute backend URLs.
 * Assets are served from API host root, NOT under /api — so we must never produce .../api/uploads/...
 * In production (Netlify), REACT_APP_API_BASE must be set so images load from the backend (Render).
 */
export function makeAbsoluteAssetUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // API host only (no /api) — uploads/visuals/content live at host root
  const raw =
    (process.env.REACT_APP_API_HOST || "").trim() ||
    (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL || "").trim();
  const apiHost =
    raw
      .replace(/\/+$/, "")
      .replace(/\/api\/?$/, "") ||
    (typeof window !== "undefined"
      ? window.location.origin.replace(/:3000$/, ":5000").replace(/:5173$/, ":5000")
      : "http://localhost:5000");

  const path = url.startsWith("/") ? url : `/${url}`;
  const normalized = path.startsWith("/api/") ? path.slice(4) : path;

  return `${apiHost}${normalized}`;
}
