# Cloudflare R2 Storage Setup

Lesson media uploads use **Cloudflare R2** for persistent storage when configured. Without R2, uploads go to local disk (ephemeral on Render).

## 1. Create R2 Bucket

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. **R2 Object Storage** → **Create bucket**
3. Name: `letsrevise-media` (or your choice)
4. **Settings** → **Public access** → Enable "Allow Access" and note the public URL (e.g. `https://pub-xxx.r2.dev`)

## 2. Create API Token

1. **R2** → **Manage R2 API Tokens** → **Create API token**
2. Permissions: **Object Read & Write**
3. Specify bucket or "Apply to all buckets"
4. Copy **Access Key ID** and **Secret Access Key**

## 3. Environment Variables

Add to backend `.env` (or Render env):

```
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=letsrevise-media
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

- **R2_ACCOUNT_ID**: Cloudflare account ID (from dashboard URL or Overview)
- **R2_PUBLIC_URL**: Bucket public URL (no trailing slash). Use R2.dev subdomain or custom domain.

## 4. Verify

```bash
curl http://localhost:5000/api/uploads/__ping
# {"ok":true,"route":"uploads","hasVideo":true,"storage":"r2"}
```

Upload an image via the lesson editor. The stored URL will look like:

```
https://pub-xxx.r2.dev/lesson-media/lesson_69abc123/page_p_xyz/block_1/image-1234567890.png
```

## Backward Compatibility

- **Existing `/uploads/...` URLs**: Still work if files exist on disk. Netlify proxies `/uploads/*` to Render. After R2 migration, old Render URLs may 404 (ephemeral disk).
- **New uploads**: Return full R2 URLs when R2 is configured.
- **Frontend**: `makeAbsoluteAssetUrl` and `toAbsoluteAssetUrl` pass through full URLs unchanged.
