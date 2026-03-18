# Dev Log

## 2026-03-17
- Confirmed new image uploads work after re-uploading lesson images.
- Identified that legacy relative URLs are the remaining source of missing lesson images.
- Moved upload flow toward storing absolute URLs instead of relative `/uploads/...` paths.
- Confirmed Netlify/Render proxy and CORS issues were a major source of production upload failures.
- Sentry configured for frontend and backend.
- Render startup issue was previously caused by missing `./config/sentry` module path.
- Migration script was added for legacy image URL conversion, but apply-mode persistence required further review.

## 2026-03-16
- Fixed major frontend/backend deployment and CORS issues.
- Verified backend health and readiness on Render.
- Confirmed Netlify frontend could talk to Render backend after env fixes.
- Debugged login and upload route issues across Netlify and Render.
