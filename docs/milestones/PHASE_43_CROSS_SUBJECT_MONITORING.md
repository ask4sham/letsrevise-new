# Phase 4.3 — Cross-Subject Monitoring

## Purpose

Phase 4.1 proved Subject Intelligence works **technically**. Phase 4.2 proved it improves **educational outcomes** (Maths +0.9 uplift, merge gate passed). Phase 4.3 ensures that improvement is **sustained** — good architecture must not be mistaken for good educational outcome on future releases.

**Flag:** monitoring only — no new Teacher Brain features in this phase.

---

## Scope

Track educational quality across six subject groups on every Teacher Brain release:

| Subject group | Validation topics (representative) |
|---------------|----------------------------------|
| **Maths** | Algebra, Simultaneous Equations, Quadratics, Graphs, Ratio, Probability, Trigonometry |
| **Physics** | Forces, Energy, Electricity, Waves |
| **History** | Causes, Consequence (Treaty), Significance (Holocaust), Interpretations (Cold War) |
| **Chemistry** | Atomic Structure, Bonding, Rates of Reaction, Electrolysis |
| **Geography** | Rivers, Urbanisation, Climate Change |
| **English** | Macbeth, Unseen Poetry, Persuasive Writing |

---

## Educational validation process

### When to run

- Before merging any Teacher Brain release that touches archetypes, subject profiles, or quality engines
- After archetype or methodology changes (mandatory)
- Quarterly spot-check even if no SI changes (regression guard)

### Protocol (same as Phase 4.1 / 4.2)

1. Generate **SI OFF vs ON** lesson pairs via live OpenAI (`runPhase41.mjs` or successor)
2. Same production flags except `TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1`
3. Human-review score each lesson (1–5) on six dimensions:
   - Explanation clarity
   - Examiner language
   - Worked reasoning
   - Misconception handling
   - Challenge level
   - Assessment quality
4. Calculate per-topic uplift (ON avg − OFF avg) and subject-group averages
5. Record in `docs/design/validation/p4.x-*/PHASE_*_HUMAN_REVIEW.md`

### Merge gates (from Phase 4.2 baseline)

| Subject | Minimum uplift (SI ON vs OFF) | Notes |
|---------|-------------------------------|-------|
| **Maths** | **≥ +0.8** | Blocker — was +0.35 pre-4.2, +0.9 post-4.2 |
| Physics | ≥ +0.4 | Validated at +0.55 (4.1), +0.4 (4.2) |
| History | ≥ +0.3 | Partial in 4.1 (+0.20), improved in 4.2 (+0.5) |
| Chemistry | ≥ +0.3 | Not yet human-validated at scale |
| Geography | ≥ +0.3 | Not yet human-validated at scale |
| English | ≥ +0.3 | Not yet human-validated at scale |

**Release blocked if Maths uplift falls below +0.8** or any subject regresses by more than 0.5 vs prior validated baseline.

---

## Subject score tracking

Maintain a rolling scorecard in `docs/design/validation/SUBJECT_SCORE_TRACKER.md` (create on first 4.3 run):

```
| Release | Date | Maths Δ | Physics Δ | History Δ | Chemistry Δ | Geography Δ | English Δ | Gate |
|---------|------|---------|-----------|-----------|-------------|-------------|-----------|------|
| 4.2     | 2026-06-22 | +0.9 | +0.4 | +0.5 | — | — | — | PASS |
```

Update after every validation run. Tag releases that pass with educational evidence (e.g. `subject-intelligence-v1-baseline`).

---

## Regression detection

### Automated signals (CI — existing)

- `tests/subjectIntelligenceResolver.test.js` — resolver never null, archetype keys resolve
- Prompt appendix non-empty when SI flag ON
- Build Integrity, Backend, Frontend, Validate Curriculum

### Educational signals (human — mandatory for archetype changes)

| Signal | Threshold | Action |
|--------|-----------|--------|
| Subject avg uplift drops > 0.3 vs prior run | Warning | Investigate before merge |
| Any topic ON score < OFF score (full lesson) | Regression | Block merge; re-seed or fix archetype |
| Maths uplift < +0.8 | **Fail gate** | Block merge |
| Worked Example block missing in ≥ 3 maths ON lessons | Quality drift | Fix methodology block placement |

### Stochastic noise mitigation

- Re-run borderline topics (±0.2 of gate) with fixed seed or second generation
- Compare framework **presence** (grep for archetype chain keywords) not score alone
- Phase 4.1 Treaty/Holocaust regressions were model noise; Phase 4.2 framework embedding fixed this

---

## Archetype quality monitoring

### Per-archetype health check

After each release, verify:

1. **Resolver** — topic hints map to expected `archetypeKey` (covered by unit tests)
2. **Methodology appendix** — `ARCHETYPE METHODOLOGY (4.2)` present in SI ON prompts for maths/history refined archetypes
3. **Learning model** — maths ON lessons use method-step language, not cause→effect
4. **History frameworks** — consequence/significance ON lessons embed full chain in core model + exam practice

### Archetype registry audit

Track count and subject coverage in `conceptArchetypes.js`:

- Maths: 10 specialised (algebra, simultaneous, quadratics, graph, ratio, probability, trigonometry, statistics, proof, general)
- History: cause, consequence (4.2 framework), significance (4.2 framework), interpretation, change, source
- Physics: force, energy, circuit, wave, practical
- Biology/Chemistry: existing archetypes unchanged

Alert if new archetypes added without corresponding validation topic.

---

## Artifacts and tooling

| Artifact | Location |
|----------|----------|
| Generation runner | `docs/design/validation/p4.1-archetype-validation/runPhase41.mjs` |
| Phase 4.2 validation | `docs/design/validation/p4.2-archetype-refinement/` |
| Human review template | `PHASE_*_HUMAN_REVIEW.md` in each validation folder |
| Baseline tag | `subject-intelligence-v1-baseline` |

---

## What Phase 4.3 is NOT

- Not more topic profiles
- Not Biology coverage expansion
- Not new archetypes without validation
- Not a substitute for unit tests — both layers required

---

## Success criteria

Phase 4.3 is complete when:

1. Subject score tracker exists and is updated for release 4.2 baseline
2. Next Teacher Brain release runs validation before merge
3. No subject falls below merge gate without documented fix or archetype revision

**The lesson from Phase 4.1:** measure educational quality, not just code quality.
