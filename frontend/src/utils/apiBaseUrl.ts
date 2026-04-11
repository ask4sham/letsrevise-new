/**
 * Single place to resolve the backend origin for **full URLs** used outside `services/api`
 * (raw `fetch`, standalone `axios`, `window.open` to backend static routes).
 *
 * For `/uploads`, `/visuals`, and markdown image URLs, use `assetUrl.ts` / `mediaUrl.ts` instead
 * (same-origin display). See `docs/URL_AND_ENV.md`.
 *
 * Delegates to `getApiHost()` from `services/api.ts`, which already encodes:
 * - `REACT_APP_API_BASE` / `REACT_APP_API_URL` (strips trailing `/api`)
 * - Same-origin `""` on Netlify/custom domains (proxy to backend)
 * - Dev localhost: `""` so `/api/*`, `/content/*`, `/uploads/*` hit CRA `setupProxy` → :5000
 * - Production without env: `window.location.origin`
 *
 * **Env (unchanged from existing app):** set `REACT_APP_API_BASE` or `REACT_APP_API_URL`
 * to your API host root (no trailing `/api`). Do not add `REACT_APP_API_BASE_URL` unless
 * you intentionally migrate naming; both existing vars are already read inside `api.ts`.
 */
import { getApiHost } from "../services/api";

/** Backend origin without `/api` (may be `""` for same-origin + proxy). */
export function getApiBaseUrl(): string {
  return getApiHost();
}

/**
 * Absolute URL for a path that starts with `/` (e.g. `/api/...`, `/content/...`).
 * When `getApiBaseUrl()` is `""`, returns `path` as a same-origin absolute path.
 */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const root = getApiHost().replace(/\/+$/, "");
  if (!root) return p;
  return `${root}${p}`;
}
