# Phase 4.2 — Archetype Refinement

## Purpose

Phase 4.1 proved the Subject Intelligence architecture works for Physics and partially for History, but **Maths uplift (+0.35) failed the merge gate**. The root cause was a single generic `maths-procedure` archetype teaching maths like science (cause → effect) instead of **method → working → checking → examiner marks**.

Phase 4.2 refines archetypes without merging Subject Intelligence to production. PR #35 remains **draft** until Maths demonstrates repeatable educational uplift.

## Merge gate (updated)

| Subject | Phase 4.1 uplift | Status | Phase 4.2 target |
|---------|------------------|--------|------------------|
| Physics | +0.55 | Validated | Maintain |
| History | +0.20 (noisy) | Partial — interpretation strong | Refine consequence + significance |
| **Maths** | +0.35 | **Blocker** | **≥ +0.8 avg uplift** |

Subject Intelligence merges to production only when Maths meets **≥ +0.8** average human-review uplift across the 7 maths validation topics.

## Architecture (unchanged)

```
Universal Teacher-First
  → Subject Intelligence
  → Archetypes
  → Assessment Skills
  → Topic Profile (only when truly needed)
```

## Phase 4.2 changes

### Maths — specialised archetypes

Replaced generic `maths-procedure` with 10 method-mark archetypes in `lib/teacherBrain/mathsArchetypesV42.js`:

| Archetype key | Topics |
|---------------|--------|
| `maths-algebra` | Algebra, linear equations, rearranging |
| `maths-simultaneous` | Simultaneous equations |
| `maths-quadratics` | Quadratics, discriminant |
| `maths-graph` | Graphs, gradient, coordinates |
| `maths-ratio` | Ratio, proportion, sharing |
| `maths-probability` | Probability, tree diagrams |
| `maths-trigonometry` | SOHCAHTOA, sine/cosine rule |
| `maths-statistics` | Mean, median, histograms |
| `maths-proof` | Show that, geometric proof |
| `maths-general` | Fallback |

Each archetype enforces this teaching chain via `teachingMethodology`:

1. Formula
2. Method
3. Worked Example
4. Common Error
5. Examiner Method Marks
6. Challenge Question

Learning model: **Method → working → check → method marks** (NOT cause → effect).

### History — framework redesign

| Archetype | New framework |
|-----------|---------------|
| `history-consequence` | Short-term impact → Long-term impact → Importance → Judgement |
| `history-significance` | Importance at the time → Importance later → Overall significance |

### Engine wiring

`lib/teacherBrain/archetypeMethodology.js` provides `formatMethodologyAppendix()` injected into:

- Subject Intelligence core prompt section
- Teacher-First supplement (no topic profile)
- Reasoning, Grade 8/9, Core Discipline, and Worked Reasoning fallbacks

Maths reasoning fallback uses method-step language instead of "mechanism → outcome".

### Resolver hints

`ARCHETYPE_TOPIC_HINTS` in `subjectIntelligenceResolver.js` prioritises simultaneous, quadratics, ratio, trig, treaty/consequence, and holocaust/significance topics.

## Validation

Re-run Phase 4.1 validation script with Phase 4.2 archetypes:

```bash
node docs/design/validation/p4.1-archetype-validation/runPhase41.mjs
```

Human-review the 30 generated lessons (15 topics × SI OFF/ON). Score using the same rubric as Phase 4.1. Record results in `docs/design/validation/p4.2-archetype-refinement/`.

## What Phase 4.2 does NOT do

- Does not merge Subject Intelligence (PR #35 stays draft)
- Does not expand Biology topic profiles
- Does not merge the Biology coverage expansion branch
- Does not change Teacher-First V1, Required Practical V2.2, or existing Biology profiles

## Files changed

| File | Change |
|------|--------|
| `lib/teacherBrain/mathsArchetypesV42.js` | New — 10 maths archetypes |
| `lib/teacherBrain/archetypeMethodology.js` | New — methodology helpers |
| `lib/teacherBrain/conceptArchetypes.js` | Import maths v4.2; history consequence/significance redesign |
| `lib/teacherBrain/subjectIntelligenceEngine.js` | Methodology appendix injection |
| `lib/teacherBrain/subjectIntelligenceResolver.js` | Archetype topic hints |
| `lib/teacherBrain/subjectIntelligenceProfiles.js` | Maths default archetypes |
| `tests/subjectIntelligenceResolver.test.js` | Phase 4.2 coverage |
