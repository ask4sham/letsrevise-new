const RENDER_BACKEND = "https://letsrevise-new.onrender.com";

/**
 * Get the asset base URL (API host root, no /api).
 * Local dev: same-origin so CRA setupProxy forwards /uploads, /visuals, /content to backend.
 * Production: same-origin so Netlify proxy forwards to Render.
 */
export function getAssetBaseUrl(): string {
  if (typeof window === "undefined") return RENDER_BACKEND;
  return window.location.origin;
}

/**
 * Resolve relative asset URLs to absolute.
 * - Relative /uploads, /visuals, /content: use getAssetBaseUrl (localhost proxy or same-origin).
 * - Absolute backend URLs (Render, api.letsrevise.com): return as-is — backend serves them; img loads cross-origin.
 * - Netlify+uploads: rewrite to backend (Netlify does not serve uploads).
 */
const NETLIFY_PATTERN = /^https?:\/\/[^/]+\.netlify\.app(\/.*)/i;
const BACKENDS = [RENDER_BACKEND, "https://api.letsrevise.com"] as const;

export function makeAbsoluteAssetUrl(url?: string | null): string | null {
  if (!url) return null;
  const u = url.trim().toLowerCase();
  if (u.startsWith("javascript:") || u.startsWith("data:") || u.startsWith("vbscript:")) return null;

  const base = getAssetBaseUrl();

  if (url.startsWith("http://") || url.startsWith("https://")) {
    const urlLower = url.trim().toLowerCase();
    // Safety: Netlify + /uploads|/visuals|/content → backend (Netlify does not serve these)
    if (urlLower.includes("netlify.app") && (urlLower.includes("/uploads/") || urlLower.includes("/visuals/") || urlLower.includes("/content/"))) {
      const match = url.trim().match(NETLIFY_PATTERN);
      if (match) return `${RENDER_BACKEND}${match[1]}`;
    }
    // Backend URLs: return as-is
    for (const backend of BACKENDS) {
      const bl = backend.toLowerCase();
      if (urlLower.startsWith(bl + "/uploads/") || urlLower.startsWith(bl + "/visuals/") || urlLower.startsWith(bl + "/content/")) {
        return url.trim();
      }
    }
    // R2 / cloud storage: pass through full URLs unchanged (persistent across deploys)
    if (urlLower.includes(".r2.dev") || urlLower.includes("r2.cloudflarestorage.com")) {
      return url.trim();
    }
    return url;
  }

  const path = url.startsWith("/") ? url : `/${url}`;
  const normalized = path.startsWith("/api/") ? path.slice(4) : path;

  // /uploads, /visuals, /content: use backend when on Netlify (Netlify does not serve these)
  const isAssetPath = normalized.startsWith("/uploads/") || normalized.startsWith("/visuals/") || normalized.startsWith("/content/");
  const isNetlify = typeof window !== "undefined" && /\.netlify\.app$/i.test(window.location.hostname);
  const assetBase = isAssetPath && isNetlify ? RENDER_BACKEND : base;

  return `${assetBase}${normalized}`;
}

/** Safe prefixes for asset paths we transform — never allow javascript:, data:, etc. */
const ASSET_PREFIXES = ["/uploads/", "/visuals/", "/content/", "uploads/", "visuals/", "content/"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

function isSafeAssetPath(url: string): boolean {
  const u = (url || "").trim().toLowerCase();
  if (u.startsWith("javascript:") || u.startsWith("data:") || u.startsWith("vbscript:")) return false;
  return ASSET_PREFIXES.some((p) => u.startsWith(p));
}

function isImageAssetUrl(url: string): boolean {
  const u = (url || "").trim();
  if (isSafeAssetPath(u)) return true;
  const lower = u.toLowerCase();
  if (lower.startsWith("http") && (ASSET_PREFIXES.some((p) => lower.includes(p)) || IMAGE_EXTENSIONS.some((e) => lower.includes(e)))) return true;
  return IMAGE_EXTENSIONS.some((e) => lower.endsWith(e) || lower.includes(e + "?"));
}

/**
 * Preprocess markdown to resolve relative asset image URLs to absolute backend URLs.
 * Also fixes legacy content that used link syntax [alt](url) instead of image syntax ![alt](url)
 * for asset URLs — those would render as links, not images.
 */
export function preprocessMarkdownAssetUrls(markdown: string): string {
  if (!markdown || typeof markdown !== "string") return markdown;
  // Fix link syntax used for images: [alt](assetUrl) -> ![alt](assetUrl) when url is an image asset
  let out = markdown.replace(/(?<!!)\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const u = (url || "").trim();
    if (!isImageAssetUrl(u)) return `[${alt}](${url})`;
    if (String(alt || "").trim().toLowerCase().startsWith("video:")) return `[${alt}](${url})`;
    return `![${alt}](${url})`;
  });
  // Resolve relative asset URLs to absolute
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
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
  return out;
}
