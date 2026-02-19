# AQA GCSE Biology seed roadmap

## Seed strategy

- **1 topicKey = 15 questions** (10 MCQ + 5 short answer) as baseline.
- **Tagging:** `subject="Biology"`, `examBoard="AQA"`, `level="GCSE"`, `topicKey`, `topic` (display).
- **Global policy — draft-only:** All bulk-seeded questions use **`status: "draft"`** only. Auto-generate then review; publish per unit after review. Existing published seeds (e.g. from earlier standalone scripts) are left untouched; we’ll publish per unit after review.
- **Idempotent:** Skip insertion if questions already exist for that `topicKey`.

## Unit 1 — Cell Biology (priority order)

| # | Topic | topicKey | Status |
|---|--------|----------|--------|
| 1 | Cell structure | `cell-structure` | ✅ PR-SEED-1 |
| 2 | Eukaryotes & Prokaryotes | `eukaryotes-prokaryotes` | ✅ PR-SEED-2 |
| 3 | Animal and plant cells | `animal-plant-cells` | |
| 4 | Cell specialisation | `cell-specialisation` | |
| 5 | Cell differentiation | `cell-differentiation` | |
| 6 | Microscopy | `microscopy` | |
| 7 | Required Practical: Microscopy | `rp-microscopy` | |
| 8 | Culturing microorganisms | `culturing-microorganisms` | |
| 9 | Required Practical: Growth | `rp-growth` | |
| 10 | Chromosomes | `chromosomes` | |
| 11 | Mitosis and the cell cycle | `mitosis-cell-cycle` | |
| 12 | Stem cells | `stem-cells` | |
| 13 | Diffusion | `diffusion` | |
| 14 | Factors that affect diffusion | `factors-affect-diffusion` | |
| 15 | Diffusion in multicellular organisms | `diffusion-multicellular` | |
| 16 | Osmosis | `osmosis` | |
| 17 | Required Practical: Osmosis | `rp-osmosis` | |
| 18 | Active transport | `active-transport` | |
| 19 | Transport summary and applications | `transport-summary` | |

**Batches (recommended):**

- **Batch A (core):** 1–6  
- **Batch B (practicals + division):** 7–12  
- **Batch C (transport):** 13–19  

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
