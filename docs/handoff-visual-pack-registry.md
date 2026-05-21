# Handoff: Visual pack registry & lesson generator images

**Stopped:** May 2026  
**Resume here** if lesson images are wrong, generic, or need more subjects/topics.

---

## Problem we were solving

- Lesson generator was attaching the **same photosynthesis overview** to many lessons (e.g. “Uses of glucose from photosynthesis”, starch-test sequences).
- Root cause: only one curated image pack existed; topic matching was too broad (`photosynthesis` anywhere in the title); AI writes diagram **text** only — export **injects** template URLs; validators checked presence of images, not relevance.

---

## What is done

### 1. Stricter injection (generator + export)

- **`visual-templates/lib/visualPackRegistry.js`** (backend) and synced **`letsrevise-generator/lib/visualTemplates/visualPackRegistry.js`** (ESM).
- Photosynthesis pack uses profile **`photosynthesis-process-v1`**: excludes glucose uses, starch test, translocation, etc.; content-aware step alignment before sequence images.
- Export no longer overwrites `meta.topic` with canonical slug (was causing false photosynthesis matches).
- Step-by-step blocks: fixed duplicate process HTML in `intro` + `content`.

### 2. Cross-subject taxonomy registry (954 packs)

- **`visual-templates/registry/pack-registry.json`** — one slot per leaf topic from all 8 specs.
- **Regenerate:** `cd backend && npm run generate:visual-pack-registry`  
  (or `node visual-templates/scripts/generate-pack-registry-from-taxonomy.js`)
- Sync generator copy: `letsrevise-generator/lib/visualTemplates/registry/pack-registry.json`

| Spec | Packs | Kind | Injects today? |
|------|-------|------|----------------|
| aqa-gcse-biology | 107 | process-linear | Only **photosynthesis** (`active`) |
| aqa-gcse-chemistry | 32 | process-linear | No (`planned`) |
| aqa-gcse-physics | 198 | process-linear | No |
| Maths / English / Further maths | 434 | taxonomy-slot | No (by design) |

### 3. Export validation warnings

- Duplicate template `imageUrl` across blocks.
- Step text vs template mismatch.
- Warnings are **non-blocking** (`visualCoherence: true`).

### 4. Docs & tests

- **`visual-templates/CROSS_SUBJECT_REGISTRY.md`** — architecture + how to add a pack.
- **Tests:**  
  - `node backend/tests/visualPackRegistry.unit.test.js`  
  - `node letsrevise-generator/lib/topicKeyResolver.test.js`  
  - `node letsrevise-generator/scripts/validate-limiting-factors-lesson.mjs`

---

## What is NOT done (future work)

1. **Assets** — Only photosynthesis SVGs exist under  
   `backend/public/visuals/biology/aqa-gcse/bioenergetics/photosynthesis/lr-process-linear-v1/`.  
   Chemistry/Physics paths in registry are **placeholders**.

2. **Activate more packs** — Set `status: "active"` in `MANUAL_PACKS` inside  
   `generate-pack-registry-from-taxonomy.js`, build visuals, add generator  
   `BROWSER_STEP_BUNDLES` in `letsrevise-generator/lib/visualTemplates/resolveVisualForLesson.js`.

3. **English/Maths visuals** — Slots exist (`taxonomy-slot`, `non-process-v1`); need a different template type or hero/manifest strategy, not `lr.process.linear.v1`.

4. **Hero images vs process packs** — Biology heroes still via `backend/utils/curatedVisuals.js` + manifest; separate from process-pack injection.

5. **Re-export old lessons** — Already-imported lessons keep old URLs until re-exported from generator.

6. **Optional:** Pass `specKey` + `topicSlug` from create-lesson UI into export meta for deterministic pack resolution.

---

## Key files (quick map)

| Area | Path |
|------|------|
| Pack list | `visual-templates/registry/pack-registry.json` |
| Eligibility rules | `visual-templates/registry/eligibility-profiles.json` |
| Registry logic (Node) | `visual-templates/lib/visualPackRegistry.js` |
| Generator export | `letsrevise-generator/lib/buildGeneratorExportJson.js` |
| Generator registry (ESM) | `letsrevise-generator/lib/visualTemplates/visualPackRegistry.js` |
| Backend resolver | `backend/utils/visualTemplateResolver.js` |
| Taxonomy source | `backend/config/*_topics.json`, `docs/TAXONOMY_TOPIC_LIST.md` |

---

## Safe rules when resuming

- Do **not** set packs to `active` without built assets — export will inject broken URLs or downgrade blocks.
- Keep **`canonicalTopicKey`** (banks/taxonomy) separate from **`visualPackId`** (image injection).
- After editing `pack-registry.json`, sync generator JSON and run tests above.
- Limiting-factors lessons must keep 3 graph blocks — see `limitingFactorsLessonRules.js`.

---

## Related conversation

Cursor transcript context: visual pack eligibility, SCENARIO label rename, interactive sequence layout — search agent transcripts for `visual pack` / `photosynthesis` / `layout-audit-phase1` if needed.
