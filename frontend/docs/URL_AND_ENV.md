# Frontend URL and environment (LetsRevise)

Internal reference to avoid reintroducing hard-coded `localhost` or Render URLs in UI code.

## Which helper to use

| Need | Use | Module |
|------|-----|--------|
| JSON API calls with auth + interceptors | `import api from "../services/api"` | `services/api.ts` |
| Raw `fetch` / standalone `axios` to `/api/...` or `/content/...` | `apiUrl("/api/...")` or `getApiBaseUrl()` | `utils/apiBaseUrl.ts` |
| Lesson images, `/uploads/...`, `/visuals/...` in markdown or display | `getAssetBaseUrl()`, `makeAbsoluteAssetUrl()`, `getUploadBaseUrl()`, `toAbsoluteAssetUrl()` | `utils/assetUrl.ts`, `services/mediaUrl.ts` |

- **`apiUrl` / `getApiBaseUrl`** follow **`services/api.ts`** `getApiHost()`: `REACT_APP_API_BASE` / `REACT_APP_API_URL`, same-origin `""` on Netlify/custom domains, dev `""` so paths hit the CRA dev server and **setupProxy**.
- **Asset helpers** use **`window.location.origin`** in the browser (same-origin as the UI). Production prefers same-origin paths so **Netlify** (or similar) can proxy `/api`, `/uploads`, `/visuals` to the backend without CORS issues.

Do not use `apiUrl()` for arbitrary static file CDN URLs (R2, Supabase); those stay full `https://` URLs.

## Environment variables (existing)

| Variable | Role |
|----------|------|
| `REACT_APP_API_BASE` / `REACT_APP_API_URL` | API host root (no trailing `/api`). Read in `services/api.ts`. |
| `REACT_APP_PUBLIC_VISUALS_CDN_URL` | Optional CDN for curated `/visuals/...` keys (`assetUrl.ts`). |
| `REACT_APP_BACKEND_URL` | **Legacy only** in `utils/uploadImage.ts` for upload POST override; prefer `REACT_APP_API_BASE`. |

## Dev proxy (`setupProxy.js`)

The **`http://localhost:5000`** target is **intentional**: the Create React App dev server runs on port **3000**; the Express API runs on **5000**. The proxy forwards browser requests from `localhost:3000` to `localhost:5000` for `/api`, `/uploads`, `/visuals`, `/content`. Do not point UI code at `:5000` directly—use `apiUrl()` or same-origin `/api/...` paths.

## Same-origin in production UI

Using **`window.location.origin`** (or empty `getApiHost()` + path) for API and asset paths lets **Netlify redirects** (`netlify.toml` / `public/_redirects`) route `/api/*`, `/uploads/*`, `/visuals/*` to the backend without the SPA hard-coding `https://…onrender.com`.

## Intentional hard-coded references (do not “fix” casually)

- **`setupProxy.js`**: `BACKEND = "http://localhost:5000"` — local API port.
- **`services/api.ts`**: `http://localhost:5000` only when `window` is undefined (non-browser / tests).
- **`utils/assetUrl.ts`**: `RENDER_BACKEND` — SSR fallback and Netlify path rewrites when the app must target the known backend host.
- **`package.json` `proxy`**: CRA metadata; same port as setupProxy target.
- **`.env.production` / Dockerfile / `_redirects`**: deployment-specific; keep in sync with hosting.

## Status

URL/env normalization for app code is considered **complete** when new features use the table above and avoid new literal backend origins in components.
