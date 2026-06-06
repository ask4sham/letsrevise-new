# Phase 3H.1.8a — Reasoning Chain + Examiner Language Engines

**Status:** Implemented (prompt-only — no mutation, no autofix)  
**Flag:** `TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE=1` (default OFF)  
**Requires:** `TEACHER_BRAIN_TEACHER_FIRST_OPENING=1`

## Scope (3H.1.8a only)

| Engine | Purpose |
|--------|---------|
| Reasoning Chain Engine | Prompt appendix + read-only scoring for explicit GCSE cause-and-effect chains |
| Examiner Language Engine | Prompt appendix + read-only scoring for examiner-framing patterns |

## Out of scope (3H.1.8b — blocked until manual review)

- Grade Extension Engine
- Core Learning Progression Engine
- Teaching Quality Autofix Engine

## Phase 3H.1.8a.1 (Layer 2 wiring + quality gate)

- Wire Teacher-First Layer 2 into SS1 `buildPrompt.js`
- Enrich Nervous System opening profile
- Placeholder + dual-output + opening-slot gate (`teachingQualityPlaceholderGate.js`)
- Anti-duplication prompt rule

## Architecture lock

Opening order remains **3H.1.6-locked** (Definition before Scenario). No interaction authority, topic boundary, or student renderer changes.

## Files

- `lib/teacherBrain/teachingQualityProfiles.js`
- `lib/teacherBrain/reasoningChainEngine.js`
- `lib/teacherBrain/examinerLanguageEngine.js`
- `lib/teacherBrain/teachingQualityUpgrade.js`
- `lib/buildPrompt.js` — SS1 prompt wiring
- `lib/lessonGeneratorV4/teacherBrainPromptAppendix.js` — V4 prompt wiring
- `tests/teachingQualityUpgrade.test.js`
- `backend/scripts/manualAcceptance3H18a.mjs`

## Acceptance topics

1. Homeostasis
2. Structure and function of the nervous system
3. The eye

## Manual review

Run:

```
node backend/scripts/manualAcceptance3H18a.mjs
```

Review artifacts:

- `docs/design/validation/3H18a/MANUAL_REVIEW.html` — open in browser for screenshots
- `docs/design/validation/3H18a/MANUAL_REVIEW.md` — before/after excerpts
- `backend/scripts/manualAcceptance3H18a-report.json` — metrics

**Next decision:** Based on lesson quality review, not metrics alone.
