# LetsRevise visual templates (GCSE Biology)

Reusable branded SVG pipeline — **not** one-off topic art files.

## Build

From repo root:

```bash
node visual-templates/scripts/build-visuals.js
# or
node visual-templates/scripts/build-visuals.js --topic photosynthesis
```

Writes to:

- `backend/public/visuals/biology/aqa-gcse/bioenergetics/photosynthesis/lr-process-linear-v1/`
- `visual-templates/output/aqa-gcse-biology/photosynthesis/` (mirror)

Updates `backend/public/visuals/biology/aqa-gcse/manifest.json` with new template entries (additive only).

## Phase 1 scope

- Template: `lr.process.linear.v1`
- Topic data: `photosynthesis.process.json`
