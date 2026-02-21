# Let's Revise — Runbook

Operations and dev setup. See `docs/architecture.md` for system design.

---

## Local Dev Setup

```bash
# Backend
cd backend
npm install
cp .env.example .env   # edit MONGODB_URI, JWT_SECRET
npm run dev            # port 5000

# Frontend
cd frontend
npm install
npm start              # port 3000, proxies /api → backend
```

---

## Seeding / Dev Tools

```bash
cd backend

# Taxonomy (public)
# GET /api/taxonomy/aqa-gcse-biology

# Seed exam questions (admin/dev)
# POST /api/dev/seed/aqa-gcse-biology/:scope  (requires ENABLE_DEV_TOOLS=1)

# Biology unit seeds
npm run seed:bio:cell-biology
npm run seed:bio:organisation
npm run seed:bio:all
```

---

## Migrations

Migrations are idempotent. Run from project root:

```bash
# Backfill TopicQuizQuestion kind + fingerprint (PR-A1)
node backend/scripts/migrations/backfill_topic_quiz_kind.js

# Backfill TopicFlashcard fingerprint (if missing)
node backend/scripts/migrations/backfill_topic_flashcard_fingerprint.js

# Run all known migrations (from backend/)
cd backend && npm run migrate:all

# Verify fingerprinted collection indexes (PR-HARD-3)
npm run verify:indexes
```

`migrate:all` covers: topic quiz kind backfill, flashcard fingerprint backfill. Past papers: if DB is empty, no migration needed; fingerprint is set on create.

---

## Operational Notes (PR-HARD-3)

### What to do if unique index conflicts appear

Bulk import may return `E11000 duplicate key` when (ownerId, topicKey, fingerprint) already exists. **Do not crash.** The API handles this with 409 or skips. To fix:

1. Run `npm run verify:indexes` — ensure unique index exists on topicflashcards, topicquizquestions, topicpastpapers.
2. If index is missing: `cd backend && npm run sync:indexes` (syncs schema indexes to MongoDB). Then rerun `npm run verify:indexes` to confirm.
3. For duplicate data: dedupe manually or use `dedupeMode: skip` on bulk import.

### How to recover from partial bulk imports

Bulk import is transactional per item; partial success is normal. The response includes `createdCount`, `skipped`, `rejected`. If the process crashed mid-import:

- Re-run the import with the same payload; duplicates will be skipped (dedupeMode: skip).
- Check `createdIds` vs expected; retry only the failed slice if needed.
- No orphan cleanup required — each item is independent.

### Uploads cleanup policy (local storage)

- **Path**: `backend/uploads/past-papers/` (per ownerId subfolder).
- **Orphan files**: If a TopicPastPaper is deleted but the FileAsset file remains on disk, it becomes orphaned. Periodic cleanup: list FileAsset refs, compare to on-disk files, delete unreferenced files (manual or cron).
- **Retention**: No auto-delete. Plan for disk growth; consider S3/comparable for production.
- **Backup**: Include `uploads/` in backups if storing user-uploaded past papers.

---

## Common Failure Fixes

| Symptom | Fix |
|---------|-----|
| 401 / JWT invalid | Clear localStorage, re-login. Ensure JWT_SECRET matches. |
| CORS errors | Backend CORS allows `http://localhost:3000`. Check FRONTEND_URL. |
| 404 on /api/* | Backend not running or wrong PORT. Default 5000. |
| MongoDB connection | Check MONGODB_URI in .env. Local: `mongodb://localhost:27017/letsrevise` |
| Upload fails | Ensure `backend/uploads/past-papers/` exists (created on first upload). FILE_UPLOAD_MAX_MB (default 25). MAX_FILES_PER_REQUEST (default 10). |
| 413 Payload too large | Bulk body limit 2MB (BULK_BODY_LIMIT_BYTES). Text length cap 2MB (BULK_MAX_TEXT_LENGTH). |
| 429 Too many requests | Rate limits: RATE_LIMIT_ENABLED=1, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_BULK/UPLOAD/ATTEMPT. |

---

## Deployment Checklist

- [ ] **Env vars**: MONGODB_URI, JWT_SECRET, PORT, FRONTEND_URL (CORS)
- [ ] **Uploads dir**: Create `backend/uploads/past-papers/`; ensure writable. Add to .gitignore (already done).
- [ ] **Rate limits**: Add express-rate-limit to bulk preview/import, upload, attempt save/submit (PR-HARD-2).
- [ ] **Body limits**: Enforce max body size on bulk routes (PR-HARD-2).
- [ ] **Migrations**: Run `npm run migrate:all` before/after deploy.
- [ ] **Indexes**: Run `npm run verify:indexes`. Unique indexes required on TopicFlashcard, TopicQuizQuestion, TopicPastPaper (ownerId + topicKey + fingerprint). Server logs warning at startup if missing.

---

## PR Order (post PR-DOC-1 merge)

Execute in this order (no other changes):

1. **PR-HARD-1**
2. **PR-HARD-2**
3. **PR-SQ1**
4. **PR-SQ2**
5. **PR-HARD-3**
