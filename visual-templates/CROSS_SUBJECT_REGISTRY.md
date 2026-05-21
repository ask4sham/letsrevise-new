# Cross-subject visual pack registry

Curated lesson images are **not** AI-generated. They are attached from **visual packs** keyed to LetsRevise taxonomy.

## Taxonomy alignment

| Taxonomy field | Example | Registry field |
|----------------|---------|----------------|
| `specKey` | `aqa-gcse-biology` | `pack.specKeys[]` |
| `topicSlug` | `photosynthesis` | `pack.topicSlugs[]` |
| Stored `topicKey` | `aqa-gcse-biology:photosynthesis` | Resolved via `resolvePackFromTaxonomy()` |

Static topic lists live in `backend/config/*_topics.json`. Full export: `docs/TAXONOMY_TOPIC_LIST.md`.

## Files

| File | Role |
|------|------|
| `registry/pack-registry.json` | All packs (Biology, Chemistry, Physics, …) |
| `registry/eligibility-profiles.json` | Per-pack rules (exclude glucose/starch, etc.) |
| `registry/aqa-gcse-biology.bindings.json` | Legacy binding file (superseded by pack-registry) |
| `lib/visualPackRegistry.js` | Resolve pack + eligibility (Node) |
| `registry/template-catalog.json` | SVG engines (`lr.process.linear.v1`, …) |

## Pack status

| Status | Behaviour |
|--------|-----------|
| `active` | Assets built; generator/export may inject URLs |
| `planned` | Taxonomy slot reserved; **no injection** until assets + `status: active` |

**Regenerate all taxonomy slots:**

```bash
node visual-templates/scripts/generate-pack-registry-from-taxonomy.js
```

This reads every `backend/config/*_topics.json` and writes **954 planned slots** (8 specs) plus the manual **active** photosynthesis override.

| Spec | Planned packs | Pack kind |
|------|---------------|-----------|
| aqa-gcse-biology | 107 | process-linear |
| aqa-gcse-chemistry | 32 | process-linear |
| aqa-gcse-physics | 198 | process-linear |
| aqa-gcse-maths-foundation | 46 | taxonomy-slot (no process inject) |
| aqa-gcse-maths-higher | 205 | taxonomy-slot |
| aqa-l2-further-maths | 53 | taxonomy-slot |
| aqa-gcse-english-language | 79 | taxonomy-slot |
| aqa-gcse-english-literature | 234 | taxonomy-slot |

**Active today:** only `biology.photosynthesis.process.v1`.

## Adding a new pack

1. Add topic to `backend/config/{spec}_topics.json` (if missing).
2. Add entry to `registry/pack-registry.json` with `specKeys`, `topicSlugs`, `publicBasePrefix`, `publicPathSegment`.
3. Add or reuse an entry in `registry/eligibility-profiles.json`.
4. Add `visual-templates/data/{spec}/your-topic.process.json` and run `node visual-templates/scripts/build-visuals.js`.
5. Set `status` to `active`.
6. Sync registry JSON to `letsrevise-generator/lib/visualTemplates/registry/` (generator copy).

## Generator sync

The Next.js generator (`letsrevise-generator`) keeps a **copy** of registry JSON under `lib/visualTemplates/registry/` and `lib/visualTemplates/visualPackRegistry.js` (ESM). When changing packs, update both repos or run sync (manual for now).

## Hero images vs process packs

- **Process packs** (this registry) — diagram / sequence / hotspot blocks on export.
- **Manifest heroes** — `backend/public/visuals/{subject}/aqa-gcse/manifest.json` + `curatedVisuals.js` (Biology only today).
