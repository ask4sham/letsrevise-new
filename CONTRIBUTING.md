# Contributing — LetsRevise Teacher Dashboard

## Non-negotiable rule: every subject/spec follows the same pattern

All new subjects/specs (AQA/OCR/Edexcel/WJEC etc.) must be implemented using the taxonomy pipeline:

1. Add taxonomy JSON: `backend/config/<spec>_topics.json`
2. Wire into loader: `backend/utils/topicTaxonomy.js` (`getTaxonomyBySpecKey`)
3. Ensure API endpoint works: `GET /api/taxonomy/<specKey>`
4. Add integration tests (taxonomy + validator must pass)
5. Add frontend option: `frontend/src/components/SpecSelector.tsx`
6. Ensure all content storage uses namespaced topic keys: `specKey:topicKey`

If any of these steps are skipped, the implementation is incomplete.

## Topic key rules

- Taxonomy topic keys are **NOT namespaced**.
- Stored content keys **ARE namespaced**: `specKey:topicKey`
- If generic headings repeat (e.g., "Context", "Mark Scheme"), their keys must be unit-prefixed to prevent collisions.

## Dependency installs (required)

This repo uses `npm ci` in CI for deterministic installs.

- Do not remove `backend/package-lock.json` or `frontend/package-lock.json`
- If you add dependencies, commit the updated lockfile(s)

Example commits (use separate lines):

```bash
git add .github/workflows/ci.yml CONTRIBUTING.md
git commit -m "chore: enforce lockfile policy and harden CI"
```

```bash
git add backend/package-lock.json frontend/package-lock.json
git commit -m "chore: commit lockfiles for deterministic installs"
```

## Validation

All taxonomy files are validated by:

- `backend/scripts/validateTaxonomies.js`
- and a Jest test that runs this script in CI.

CI includes a fast-fail taxonomy validation job. If this check fails, the PR will not run full tests or builds.

Run locally:

- `cd backend`
- `npm run validate:taxonomies`
- `npm test`

## Media upload (PR-BULK-INGEST-3)

Admin media upload endpoint: `POST /api/admin/media/upload` (auth required). Accepts multipart file upload (png/jpg/webp/pdf), stores under `backend/uploads/` (local storage), dedupes by SHA-256 per owner. Uploaded files are served at `/uploads/...`. Bulk import payloads (flashcards, exam questions) can include `assets: [{ type, mediaId, url, alt }]` to reference uploaded media.

## Past papers bulk import (PR-BULK-INGEST-4)

Admin bulk import: `POST /api/admin/bulk-import/past-papers` and `POST /api/admin/bulk-import/past-paper-questions` (auth required). CSV→JSON converters: `npm run convert:past-papers-csv -- <specKey> <path/to.csv>` and `npm run convert:past-paper-questions-csv -- <specKey> <path/to.csv>`. See `backend/scripts/examples/` for PowerShell examples (dryRun by default).

## PR expectations

Each new subject/spec should be delivered in:

- PR-1: taxonomy JSON + API + tests
- PR-2: SpecSelector + UI verification
- PR-3 (optional): ingestion tooling / validation improvements

## Definition of Done

A spec is "done" when:

- `/api/taxonomy/<specKey>` returns normalized payload
- SpecSelector loads the spec and pickers populate
- Banks + lesson generation use `specKey` and namespaced topic keys
- Validator + tests pass

See also: [docs/ADDING_NEW_SUBJECT_SPEC.md](docs/ADDING_NEW_SUBJECT_SPEC.md) for the full Cursor repro rule and checklist.
