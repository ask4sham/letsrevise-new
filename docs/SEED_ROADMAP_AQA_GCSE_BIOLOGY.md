# AQA GCSE Biology seed roadmap

## Seed strategy

- **1 topicKey = 15 questions** (10 MCQ + 5 short answer) as baseline.
- **Tagging:** `subject="Biology"`, `examBoard="AQA"`, `level="GCSE"`, `topicKey`, `topic` (display), `status="draft"` (teacher/admin review later) or `"published"` per PR.
- **Idempotent:** Skip insertion if questions already exist for that `topicKey`.

## Unit 1 — Cell Biology (priority order)

| # | Topic | topicKey | Status |
|---|--------|----------|--------|
| 1 | Cell structure | `cell-structure` | ✅ PR-SEED-1 |
| 2 | Eukaryotes and prokaryotes | `eukaryotes-prokaryotes` | ✅ PR-SEED-2 |
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

- **Next after PR-SEED-2:** Either one topic per PR (2–6) or bundle Cell Biology Batch A (topics 2–6) in one PR once the pattern is stable.
- **Script naming:** `seed_<topic_slug>_questions.js` or `seed_aqa_gcse_biology_<topic_slug>.js`; resolve `topicKey` from `config/aqa_gcse_biology_topics.json`.
