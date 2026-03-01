# AQA GCSE Biology seed roadmap

## Seed strategy

- **1 topicKey = 25 items** (10 MCQ + 5 short answer + 10 flashcards) as baseline.
- **Tagging:** `subject="Biology"`, `examBoard="AQA"`, `level="GCSE"`, `topicKey`, `topic` (display).
- **Global policy — draft-only:** All bulk-seeded questions use **`status: "draft"`** only. Auto-generate then review; publish per unit after review. Existing published seeds (e.g. from earlier standalone scripts) are left untouched; we’ll publish per unit after review.
- **Idempotent:** Skip insertion if questions already exist for that `topicKey`.

## Unit 1 — Cell Biology (taxonomy order from `docs/TAXONOMY_TOPIC_LIST.csv`)

Source: filter `specKey == "aqa-gcse-biology"`, `mainTopicTitle == "Cell Biology"`. **Do not seed using un-namespaced slugs; always use topicKey `specKey:topicSlug`** so it matches `specTopicValidation` / `getTaxonomyBySpecKey` at runtime (e.g. `aqa-gcse-biology:cell-structure`).

| # | Topic (leaf) | topicSlug | topicKey | Status |
|---|--------------|-----------|----------|--------|
| 1 | Cell structure | cell-structure | `aqa-gcse-biology:cell-structure` | ✅ PR-SEED-1 |
| 2 | Animal and plant cells | animal-plant-cells | `aqa-gcse-biology:animal-plant-cells` | TODO |
| 3 | Eukaryotes and prokaryotes | eukaryotes-prokaryotes | `aqa-gcse-biology:eukaryotes-prokaryotes` | ✅ PR-SEED-2 |
| 4 | Cell specialisation | cell-specialisation | `aqa-gcse-biology:cell-specialisation` | TODO |
| 5 | Cell differentiation | cell-differentiation | `aqa-gcse-biology:cell-differentiation` | TODO |
| 6 | Microscopy | microscopy | `aqa-gcse-biology:microscopy` | TODO |
| 7 | Required Practical: Microscopy | rp-microscopy | `aqa-gcse-biology:rp-microscopy` | TODO |
| 8 | Cell Division | cell-division | `aqa-gcse-biology:cell-division` | TODO |
| 9 | Chromosomes | chromosomes | `aqa-gcse-biology:chromosomes` | TODO |
| 10 | Mitosis and the cell cycle | mitosis-cell-cycle | `aqa-gcse-biology:mitosis-cell-cycle` | TODO |
| 11 | Stem cells | stem-cells | `aqa-gcse-biology:stem-cells` | TODO |
| 12 | Transport in Cells | transport-in-cells | `aqa-gcse-biology:transport-in-cells` | TODO |
| 13 | Diffusion | diffusion | `aqa-gcse-biology:diffusion` | TODO |
| 14 | Factors that affect diffusion | factors-affect-diffusion | `aqa-gcse-biology:factors-affect-diffusion` | TODO |
| 15 | Osmosis | osmosis | `aqa-gcse-biology:osmosis` | TODO |
| 16 | Required Practical: Osmosis | rp-osmosis | `aqa-gcse-biology:rp-osmosis` | TODO |
| 17 | Active transport | active-transport | `aqa-gcse-biology:active-transport` | TODO |
| 18 | Diffusion in multicellular organisms | diffusion-multicellular | `aqa-gcse-biology:diffusion-multicellular` | TODO |
| 19 | Transport summary and applications | transport-summary | `aqa-gcse-biology:transport-summary` | TODO |
| 20 | Culturing microorganisms | culturing-microorganisms | `aqa-gcse-biology:culturing-microorganisms` | TODO |
| 21 | Required Practical: Growth | rp-growth | `aqa-gcse-biology:rp-growth` | TODO |

**Batches (recommended):**

- **Batch A (core):** 1–6  
- **Batch B (practicals + division):** 7–12  
- **Batch C (transport):** 13–21  

## Unit 2 — Organisation

Principles of organisation → Enzymes → RP Enzymes → Digestive system → RP Food tests → Heart / Blood / Lungs → Health & disease → Plant tissues & transport.

## Unit 3 — Infection & Response

Communicable diseases → Viral/bacterial/fungal/protist → Defence systems → Vaccination → Antibiotics → Drug development → Monoclonal antibodies → Plant disease.

## Unit 4 — Bioenergetics

Photosynthesis → Rate/limiting factors (+ RP) → Respiration → Exercise → Metabolism.

## Unit 5 — Homeostasis & Response

Nervous system (reflex, RP reaction time) → Brain → Eye → Temperature → Endocrine → Blood glucose → Water/nitrogen → Plant hormones (+ RP).

## Unit 6 — Inheritance, Variation & Evolution

Reproduction → Meiosis → DNA/genome → Inheritance → Variation/evolution → Selective breeding/GE/cloning → Evidence/fossils → Resistant bacteria → Classification.

## Unit 7 — Ecology

Adaptation/competition → Communities → Abiotic/biotic → Ecosystems (+ RP) → Cycles/decomposition (+ RP) → Biodiversity → Human impacts → Trophic levels → Food production/security.

## PR approach

- **PR-SEED-ALL-1 (Commit 1):** Bulk pack for Cell Biology. One script per topic under `backend/scripts/aqa_gcse_biology/` using shared helper `_seedHelpers/aqaBioSeedUtils.js`. Topic-level idempotent; `status: "draft"`.
- **NPM scripts:** `npm run seed:bio:cell-biology` (all Cell Biology topics); `npm run seed:bio:all` (all units, currently Cell Biology only); `npm run seed:bio:cell-biology:cell-structure` (single topic example).
- **Script naming:** `seed_<unitKey>__<topicKey>.js` (e.g. `seed_cell-biology__cell-structure.js`). `topicKey` resolved from `config/aqa_gcse_biology_topics.json` via helper (no hardcoding).
- **Commit 2 (done):** Per-topic scripts and unit runners for Organisation, Infection and Response, Bioenergetics, Homeostasis and Response, Inheritance Variation and Evolution, Ecology. All wired in `seed_all.js`. NPM: `seed:bio:organisation`, `seed:bio:infection-and-response`, `seed:bio:bioenergetics`, `seed:bio:homeostasis-and-response`, `seed:bio:inheritance-variation-evolution`, `seed:bio:ecology`, `seed:bio:all`.
