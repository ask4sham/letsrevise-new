# Legacy Image URL Migration

## Overview

One-off migration to convert legacy relative markdown asset URLs in stored lesson content into absolute backend URLs.

**Root cause:** New uploads now store absolute URLs (e.g. `https://letsrevise-new.onrender.com/uploads/...`), but existing lesson/revision content in the database may still contain relative paths like:

```markdown
![alt](/uploads/lesson-media/...)
![alt](/visuals/...)
![alt](/content/...)
```

These older records depend on frontend rewrite logic and can remain fragile in production.

## Models/Collections Touched

| Model | Fields |
|-------|--------|
| **Lesson** | `content` (legacy markdown blob), `pages[].blocks[].content`, `pages[].blocks[].imageUrl`, `pages[].hero.src` |
| **Template** | `pages[].blocks[].content` |

## Transform Rules

- **Safe paths:** `/uploads/`, `/visuals/`, `/content/` (and variants without leading slash)
- **Rejected:** `javascript:`, `data:`, `vbscript:` (never transformed)
- **Preserved:** Alt text, non-asset external URLs (http/https), non-image markdown

## Configuration

Set the backend base URL via environment variable:

```bash
BACKEND_PUBLIC_URL=https://letsrevise-new.onrender.com
```

Default: `https://letsrevise-new.onrender.com`

For local/staging migration:

```bash
BACKEND_PUBLIC_URL=http://localhost:5000 node backend/scripts/migrate-legacy-image-urls.js
```

## Commands

### Dry run (report only, no writes)

```bash
node backend/scripts/migrate-legacy-image-urls.js
```

Or from backend directory:

```bash
cd backend && npm run migrate:legacy-image-urls
```

### Write mode (perform updates)

```bash
node backend/scripts/migrate-legacy-image-urls.js --apply
```

Or:

```bash
cd backend && npm run migrate:legacy-image-urls:apply
```

### Running in Render shell (production)

Render sets `MONGO_URI` automatically in the shell. No local `.env` changes needed.

**Dry run:**
```bash
cd /opt/render/project/src/backend
node scripts/migrate-legacy-image-urls.js
```

**Apply migration:**
```bash
cd /opt/render/project/src/backend
node scripts/migrate-legacy-image-urls.js --apply
```

## Before / After

**Before:**
```markdown
![cell-diagram](/uploads/lesson-media/lesson_abc/page_1/block_0/cell-123.png)
```

**After:**
```markdown
![cell-diagram](https://letsrevise-new.onrender.com/uploads/lesson-media/lesson_abc/page_1/block_0/cell-123.png)
```

## Rollback / Safety

1. **Backup first:** Take a MongoDB backup before running with `--apply`.
2. **Dry run first:** Always run without `--apply` to inspect the report.
3. **Idempotent:** Running the migration twice is safe; already-absolute URLs are left unchanged.
4. **No data loss:** Only URL strings are transformed; content structure is preserved.
5. **Derived data:** After migration, consider re-running `embedKnowledgeDocuments` or `buildKnowledgeIndex` if your KnowledgeDocument/RAG chunks are derived from lesson content.

## Script Location

`backend/scripts/migrate-legacy-image-urls.js`

## Troubleshooting: Script Missing in Render Shell

If `migrate-legacy-image-urls.js` is missing in Render Shell:

1. **Verify Render Root Directory** is set to `backend` (Dashboard → Service → Settings → Build & Deploy).
2. **Redeploy** after the Dockerfile fix (explicit `COPY scripts`) is merged.
3. **Verify after redeploy:**
   ```bash
   cd /opt/render/project/src/backend
   ls scripts | grep migrate
   ```
   Expected: `migrate-legacy-image-urls.js`
