# Drag-and-drop visual contract — validation report

**Date:** 2026-06-01  
**Contract:** [`../DRAG_DROP_VISUAL_CONTRACT.md`](../DRAG_DROP_VISUAL_CONTRACT.md)  
**Scope:** Image prompts and mock artwork only. No code, CSS, renderer, Teacher Brain, or lesson data changes.

---

## Method

1. Wrote three **IMAGE DESIGN REQUIREMENTS** prompts from the frozen contract.
2. Compared outputs against contract targets (258×52px cards in-app, 232×76px printed boxes, 68/32 layout).
3. **Reflex arc:** existing contract-aligned SVG → PNG (`validation-reflex-arc-portrait.png`).
4. **Plant disease & photosynthesis:** AI mock renders for prompt QA (`validation-*-portrait.png` in this folder).

Concept cards were **not** drawn in images (per contract). Fit scores assume separate in-app cards ~258×52–72px.

---

## Image prompts (official validation set)

### 1. Reflex arc

```text
IMAGE DESIGN REQUIREMENTS

Artboard: 900 × 1350 portrait
Layout: 68% left = reflex pathway top-to-bottom; 32% right = empty drop rectangles only
Title: DRAG AND DROP MATCH
Subtitle: Match each structure to its function.

Diagram (left, numbered, arrows down):
1. Stimulus / receptor — pain receptor in skin (e.g. sharp object)
2. Sensory neurone — impulse to CNS (blue)
3. Relay neurone in spinal cord / CNS (green, grey matter cross-section)
4. Motor neurone — impulse to effector (red)
5. Effector — muscle and gland
6. Response — e.g. hand withdraws

Drop zones (right rail, empty, 232 × 76 px each, ~120 px between tops):
A — align with sensory neurone
B — align with relay neurone
C — align with motor neurone
D — align with effector

In-app concept cards (NOT in image):
- Sensory neurone → Carries impulses from receptor to the CNS
- Relay neurone → Links neurones inside the spinal cord for fast reflexes
- Motor neurone → Carries impulses from the CNS to a muscle or gland
- Effector → Produces the response

Style: white background, GCSE AQA LetsRevise, thick black outlines, minimal colour, no clutter.
```

### 2. Plant disease

```text
IMAGE DESIGN REQUIREMENTS

Artboard: 900 × 1350 portrait
Layout: 68% left = vertical plant-disease sequence; 32% right = empty drop rectangles only
Title: DRAG AND DROP MATCH
Subtitle: Match each structure to its function.

Diagram (left, numbered, arrows down):
1. Physical barrier — leaf cross-section, waxy cuticle / cell wall labelled
2. Pathogen — fungus spores or bacterial entry on leaf surface
3. Symptom — chlorotic / yellow patch (magnesium deficiency or disease sign)
4. Control — removing infected tissue / crop hygiene icon

Drop zones (right rail, empty, 232 × 76 px each):
A — align with physical barrier (waxy cuticle)
B — align with pathogen
C — align with symptom / deficiency sign
D — align with control measure

In-app concept cards (NOT in image):
- Waxy cuticle → Physical defence against pathogens
- Fungus / bacteria → Infectious agent causing disease
- Yellow leaves (chlorosis) → Sign of magnesium deficiency or disease
- Remove infected plants → Reduces spread of disease

Style: white background, GCSE AQA LetsRevise, thick black outlines, minimal colour.
```

### 3. Photosynthesis

```text
IMAGE DESIGN REQUIREMENTS

Artboard: 900 × 1350 portrait
Layout: 68% left = photosynthesis inputs/outputs top-to-bottom; 32% right = empty drop rectangles only
Title: DRAG AND DROP MATCH
Subtitle: Match each structure to its function.

Diagram (left, numbered, arrows down):
1. Light — sun → chlorophyll in chloroplast (leaf cross-section)
2. Carbon dioxide — CO₂ entering stoma
3. Glucose — product in chloroplast
4. Oxygen — O₂ leaving stoma
Footer (small): word equation carbon dioxide + water → glucose + oxygen (light, chlorophyll)

Drop zones (right rail, empty, 232 × 76 px each):
A — align with chlorophyll / light absorption
B — align with carbon dioxide uptake
C — align with glucose (product)
D — align with oxygen (product)

In-app concept cards (NOT in image):
- Chlorophyll → Absorbs light energy for photosynthesis
- Carbon dioxide → Raw material taken in for photosynthesis
- Glucose → Sugar product of photosynthesis
- Oxygen → Gas released during photosynthesis

Style: white background, GCSE AQA LetsRevise, thick black outlines, minimal green/blue accents.
```

---

## Comparison matrix

| Criterion | Reflex arc (reference PNG) | Plant disease (AI mock) | Photosynthesis (AI mock) |
|-----------|---------------------------|-------------------------|--------------------------|
| **Artboard portrait 900×1350** | ✅ True 2∶3 portrait | ⚠️ Rendered ~landscape/wide | ⚠️ Rendered ~landscape/wide |
| **68 / 32 split** | ✅ Clear left pathway + right rail | ✅ Approximate | ✅ Approximate |
| **Drop zone size (232×76)** | ✅ Boxes match contract proportion | ⚠️ Slightly small vs pathway | ⚠️ Narrow boxes, wide gutters |
| **Drop zone labels A–D only** | ✅ | ✅ | ✅ |
| **No answer text in boxes** | ✅ | ✅ | ✅ |
| **Vertical box spacing (~120px)** | ✅ Even stack | ✅ Reasonable | ✅ Reasonable |
| **A–D aligned to pathway steps** | ✅ | ✅ Per step 1–4 | ✅ Per step 1–4 |
| **Card fit (258×52 target)** | ✅ Long labels fit one line in app | ✅ Short GCSE labels OK | ✅ Short labels OK |
| **Readability** | ✅ Large type, high contrast | ✅ Good | ✅ Good; equation readable |
| **Classroom suitability** | ✅ Exam-focus footer; AQA tone | ✅ Clear sequence | ✅ Strong for B1 bioenergetics |

**Legend:** ✅ Meets contract · ⚠️ Partial · ❌ Misses

---

## Findings

### What works (reflex reference)

The SVG-derived **reflex portrait** is the benchmark: portrait artboard, right-rail **232×76** boxes, pathway not crowded into the drop column, and spacing that matches where **~260×60–80px** concept cards sit in the live UI (SS1 observation).

### What AI mocks reveal

- **Prompt compliance is inconsistent** on artboard orientation unless enforced (“must be taller than wide, 900 wide × 1350 tall, no landscape”).
- **Drop zones** in mocks are often **smaller than 232×76** relative to the diagram, reproducing the “image and UI fighting” problem the contract was written to fix.
- **Pedagogy and readability** are strong for plant disease and photosynthesis mocks; they are suitable for classroom use **after** resize/recompose to portrait and box dimensions.

### Card fit vs drop-zone fit

| Activity | Card fit (app panel) | Drop-zone fit (printed) |
|----------|----------------------|-------------------------|
| Reflex arc | Excellent — single-line neurone names | Excellent |
| Plant disease | Good — short defence/symptom labels | Moderate — boxes OK, scale drift in AI |
| Photosynthesis | Good — chlorophyll, CO₂, glucose, O₂ | Moderate — boxes narrow in AI mock |

---

## Screenshots (this folder)

| File | Activity |
|------|----------|
| `validation-reflex-arc-portrait.png` | Reflex arc (contract reference) |
| `validation-plant-disease-portrait.png` | Plant disease (AI prompt mock) |
| `validation-photosynthesis-portrait.png` | Photosynthesis (AI prompt mock) |

---

## Recommendation

1. **Keep** `DRAG_DROP_VISUAL_CONTRACT.md` as the single source of truth.
2. **Phase 2:** Inject the prompt block verbatim into Teacher Brain; add hard constraints: `MUST be portrait 900×1350`, `drop rectangles exactly 232×76 px at 900px width scale`.
3. **Production assets:** Prefer **SVG template** (like reflex) over raw AI raster for dimension fidelity.
4. **Do not** change renderer/CSS until images are generated to contract; alignment is an **asset + brief** problem, not a layout bug.

---

## Validation verdict

| Activity | Ready for production image? |
|----------|----------------------------|
| Reflex arc | ✅ Yes (reference asset exists) |
| Plant disease | ⚠️ Prompt OK; artwork needs portrait + box sizing pass |
| Photosynthesis | ⚠️ Prompt OK; artwork needs portrait + box sizing pass |

**Overall:** Contract dimensions are validated against the working reflex asset. Prompts are ready for Teacher Brain Phase 2; AI-only generation needs stricter orientation/size clauses or SVG workflow.
