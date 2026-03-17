/**
 * Get the asset base URL (API host root, no /api).
 * Local dev: http://localhost:5000
 * Production: REACT_APP_API_BASE (e.g. https://letsrevise-new.onrender.com)
 */
export function getAssetBaseUrl(): string {
  const raw =
    (process.env.REACT_APP_API_HOST || "").trim() ||
    (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL || "").trim();
  return (
    raw
      .replace(/\/+$/, "")
      .replace(/\/api\/?$/, "") ||
    (typeof window !== "undefined"
      ? window.location.origin.replace(/:3000$/, ":5000").replace(/:5173$/, ":5000")
      : "http://localhost:5000")
  );
}

/**
 * Resolve relative asset URLs (e.g. /uploads/..., /visuals/..., /content/...) to absolute backend URLs.
 * Assets are served from API host root, NOT under /api — so we must never produce .../api/uploads/...
 * In production (Netlify), REACT_APP_API_BASE must be set so images load from the backend (Render).
 */
export function makeAbsoluteAssetUrl(url?: string | null): string | null {
  if (!url) return null;
  const u = url.trim().toLowerCase();
  if (u.startsWith("javascript:") || u.startsWith("data:") || u.startsWith("vbscript:")) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const apiHost = getAssetBaseUrl();
  const path = url.startsWith("/") ? url : `/${url}`;
  const normalized = path.startsWith("/api/") ? path.slice(4) : path;

  return `${apiHost}${normalized}`;
}

/** Safe prefixes for asset paths we transform — never allow javascript:, data:, etc. */
const ASSET_PREFIXES = ["/uploads/", "/visuals/", "/content/", "uploads/", "visuals/", "content/"];

function isSafeAssetPath(url: string): boolean {
  const u = (url || "").trim().toLowerCase();
  if (u.startsWith("javascript:") || u.startsWith("data:") || u.startsWith("vbscript:")) return false;
  return ASSET_PREFIXES.some((p) => u.startsWith(p));
}

/**
 * Preprocess markdown to resolve relative asset image URLs to absolute backend URLs.
 * Used for legacy content; new uploads store absolute URLs via mediaUrl.toAbsoluteAssetUrl.
 * Safe: only transforms known asset paths, rejects javascript:/data: etc.
 */
export function preprocessMarkdownAssetUrls(markdown: string): string {
  if (!markdown || typeof markdown !== "string") return markdown;
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const u = (url || "").trim();
    if (!isSafeAssetPath(u)) return `![${alt}](${url})`;
    let decoded = u;
    try {
      if (u.includes("%")) decoded = decodeURIComponent(u);
    } catch {
      decoded = u;
    }
    const abs = makeAbsoluteAssetUrl(decoded);
    if (abs) return `![${alt}](${abs})`;
    return `![${alt}](${url})`;
  });
}
