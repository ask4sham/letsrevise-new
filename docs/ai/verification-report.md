# Production Verification Report: Legacy Image URLs

**Date:** 2025-03-18  
**Scope:** Migration results, image rendering, upload flow integrity

---

## 1. Migration Results (DB / Query Output)

| Metric | Value |
|--------|-------|
| Lessons with legacy relative URLs | **0** |
| Templates with legacy relative URLs | **0** |
| Dry-run: documents that would be updated | **0** |
| Migration status | **Clean** |

**Verification commands run:**
- `node scripts/verify-legacy-urls.js` → 0 lessons, 0 templates
- `node scripts/migrate-legacy-image-urls.js` (dry-run) → 0 updates needed

**Note:** No lessons or templates were updated by the migration because the database was already clean (all image URLs were already absolute). The 9 lessons in the DB store absolute URLs (`https://letsrevise-new.onrender.com/uploads/...` or `.../visuals/...`).

---

## 2. Representative Lessons Spot Check

Three lessons with images were inspected:

| Lesson ID | Title | Fields checked | Result |
|-----------|------|----------------|--------|
| 69abe288634922917024b79f | Cell structure – Cell Biology (AQA GCSE) | hero.src, blocks[].content | All absolute URLs |
| 69ac52012ab324862fa7f493 | Animal and plant cells – Cell Biology (AQA GCSE) | blocks[].content | All absolute URLs |
| 69ac8d148d76e08d5b4aae0a | Eukaryotic & Prokaryotic Cells (AQA GCSE) | hero.src, blocks[].content | All absolute URLs |

- **Content structure:** Intact; no malformed or double-prefixed URLs.
- **URL format:** All use `https://letsrevise-new.onrender.com/uploads/...` or `.../visuals/...`.

---

## 3. Frontend Rendering Logic

### Components using URL resolution (correct)

| File | Usage |
|------|-------|
| `LessonViewPage.tsx` | `preprocessMarkdownAssetUrls(text)` before ReactMarkdown; `makeAbsoluteAssetUrl(block.imageUrl)`, `makeAbsoluteAssetUrl(hero.src)` |
| `EditLessonPage.tsx` | `preprocessMarkdownAssetUrls` + `urlTransform` for relative paths; `makeAbsoluteAssetUrl(d.imageUrl)` for diagrams |
| `CitationsList.tsx` | `makeAbsoluteAssetUrl(c.imageUrl)` |
| `InlineDiagramBlock.tsx` | `makeAbsoluteAssetUrl(imageUrl)` |
| `LessonRenderer.tsx` | `makeAbsoluteAssetUrl(block.src)` for image blocks |

### Core utilities (`frontend/src/utils/assetUrl.ts`)

- **`makeAbsoluteAssetUrl`:** Resolves relative `/uploads/`, `/visuals/`, `/content/` to same-origin; rewrites Render URLs to same-origin for CORS.
- **`preprocessMarkdownAssetUrls`:** Converts relative asset URLs in markdown to absolute; fixes `[alt](url)` → `![alt](url)` for image assets.

### Components without `preprocessMarkdownAssetUrls` (fallback gaps)

| File | Line | Content | Risk |
|------|------|---------|------|
| `ClassroomModePage.tsx` | 445–456 | Block content via `<ReactMarkdown>{text}</ReactMarkdown>` | Low – DB has no legacy URLs |
| `EnhancedLessonView.tsx` | 242 | `lesson.content` via `<ReactMarkdown>{lesson.content}</ReactMarkdown>` | Low |
| `LessonAttemptReportPage.tsx` | 615 | `plan.content` | Low |
| `DocsViewerPage.tsx` | 173 | Markdown content | Low |
| `ClassroomModePage.tsx` | 543 | `reteachPlan.content` | Low |

**Recommendation:** Add `preprocessMarkdownAssetUrls` to these components when convenient. Not urgent while DB is clean.

### No obsolete URL-rewrite hacks

- `preprocessMarkdownAssetUrls` and `makeAbsoluteAssetUrl` are the intended resolution layer.
- No redundant or conflicting URL-rewrite logic found.

---

## 4. Upload Flow Verification

| Check | Status | Details |
|-------|--------|---------|
| Frontend uses `/api/uploads/image` | ✅ | `ImageUploader.tsx`, `CreateLessonPage.tsx`, `EditLessonPage.tsx` use `api.post("uploads/image", form)` |
| Netlify proxy | ✅ | `netlify.toml`: `/api/*` → Render; `/uploads/*`, `/visuals/*` → Render |
| Backend upload response | ⚠️ Relative | Returns `url: "/uploads/lesson-media/..."` (relative) |
| Frontend converts before storing | ✅ | `toAbsoluteAssetUrl(url)` before inserting into markdown |
| Direct browser → Render calls | ✅ None | `api.ts`: Netlify uses `baseURL: ""` (same-origin) |

**Backend upload routes:**
- `POST /api/uploads/image` – images (folder from query)
- `POST /api/uploads/video` – videos
- `POST /api/uploads/lesson-media` – lesson images (auth)
- `POST /api/uploads/lesson-image` – lesson images (field `image`)

All return relative `url`; frontend converts to absolute before storing.

---

## 5. Verification Summary

| Area | Status | Notes |
|------|--------|------|
| Migration | **Clean** | 0 legacy URLs; dry-run reports 0 updates |
| Rendering | **Clean** | Main views use `preprocessMarkdownAssetUrls` and `makeAbsoluteAssetUrl` |
| Upload | **Clean** | Same-origin via Netlify proxy; frontend stores absolute URLs |

---

## 6. Remaining Edge Cases

1. **ClassroomModePage, EnhancedLessonView, etc.** – Markdown without `preprocessMarkdownAssetUrls`. Low risk while DB is clean; add preprocessing when touching these components.
2. **ClassroomModePage diagram blocks** – `renderDiagramBlock` does not handle `block.imageUrl` (AI-generated diagrams); only `visualId`. Separate feature gap, not migration-related.

---

## 7. Files Worth Cleaning Later (optional)

| File | Change | Risk |
|------|--------|------|
| `ClassroomModePage.tsx` | Wrap markdown in `preprocessMarkdownAssetUrls(text)` | Low |
| `EnhancedLessonView.tsx` | `preprocessMarkdownAssetUrls(lesson.content)` | Low |
| `LessonAttemptReportPage.tsx` | `preprocessMarkdownAssetUrls(plan.content)` | Low |
| `DocsViewerPage.tsx` | `preprocessMarkdownAssetUrls` for markdown content | Low |

No changes required for current verification; these are future hardening steps.

---

## 8. MongoDB Verification Queries

**Lessons:**
```javascript
db.lessons.find({ $or: [
  { content: /\]\(\s*\/?(uploads|visuals|content)\// },
  { uploadedImages: /^\/(uploads|visuals|content)\// },
  { "pages.blocks.content": /\]\(\s*\/?(uploads|visuals|content)\// },
  { "pages.blocks.imageUrl": /^\/(uploads|visuals|content)\// },
  { "pages.hero.src": /^\/(uploads|visuals|content)\// }
]}).count()
```
Expected: **0**

**Templates:**
```javascript
db.templates.find({ "pages.blocks.content": /\]\(\s*\/?(uploads|visuals|content)\// }).count()
```
Expected: **0**
