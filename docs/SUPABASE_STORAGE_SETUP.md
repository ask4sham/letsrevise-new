# Supabase Storage for Lesson Media

Lesson media uploads use **Supabase Storage** when configured. Files are stored persistently and survive Render deploys.

## 1. Create Bucket

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Storage**
2. **New bucket** → Name: `lesson-media` (or set `SUPABASE_MEDIA_BUCKET` env var)
3. **Public bucket**: Enable "Public bucket" so `getPublicUrl()` returns accessible URLs

## 2. Bucket Policy (Public Access)

For public read access:

- **Storage** → **Policies** → Add policy
- Policy: Allow public read for `lesson-media` bucket
- Or use Supabase default: when bucket is "Public", objects are readable via public URL

## 3. Environment Variables

Add to backend `.env` (or Render env):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_MEDIA_BUCKET=lesson-media
```

- **SUPABASE_URL**: Project URL from Supabase dashboard
- **SUPABASE_SERVICE_ROLE_KEY**: Service role key (Settings → API) — **keep secret**
- **SUPABASE_MEDIA_BUCKET**: Optional; defaults to `lesson-media`

## 4. Path Structure

Object keys in the bucket (no duplicate bucket name):

```
lesson_<lessonId>/page_<pageId>/block_<blockIndex>/<filename>
```

Example: `lesson_69abc123/page_p_xyz/block_1/cell-mitosis-1234567890.png`

The frontend sends folder `lesson-media/lesson_xxx/...`; the backend strips the leading `lesson-media/` so the object key does not duplicate the bucket name.

## 5. Example Returned URL

```
https://your-project.supabase.co/storage/v1/object/public/lesson-media/lesson_69abc123/page_p_xyz/block_1/image.png
```

## 6. Verify

```bash
curl http://localhost:5000/api/uploads/__ping
# {"ok":true,"route":"uploads","hasVideo":true,"storage":"supabase"}
```

## 7. Migration Strategy for Old Images

**Existing `/uploads/...` or Render URLs:**

- **Option A (no migration):** Old URLs continue to work if files exist on Render disk. After deploys, they may 404. New uploads use Supabase.
- **Option B (migrate):** Run a script to:
  1. Find lessons with `/uploads/` or Render URLs in `pages[].blocks[].content`, `lesson.content`, `hero.src`, `blocks[].imageUrl`
  2. Download each file from Render (or local backup)
  3. Upload to Supabase Storage
  4. Replace URLs in lesson documents with Supabase public URLs
  5. Save lessons

Example migration script structure:

```javascript
// backend/scripts/migrate-uploads-to-supabase.js
// 1. Query lessons with image URLs
// 2. For each URL: fetch file, upload to Supabase, get public URL
// 3. Replace URL in content
// 4. Save lesson
```

Run only after Supabase Storage is configured and bucket exists.
