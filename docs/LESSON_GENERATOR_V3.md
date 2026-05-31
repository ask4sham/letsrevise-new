# Lesson Generator V3 — Structural Enforcement

V3 turns the V2 blueprint into **mandatory architecture** before lesson publication.

## Pipeline

```
Blueprint (V2) → Architecture Engine → AI Generation → Structural Enforcer → Validators → Quality Gate → Export
```

## Modules (`lib/`)

| File | Role |
|------|------|
| `lessonArchitectureEngine.js` | Blueprint → mandatory `lessonArchitecture[]` |
| `lessonArchitectureValidator.js` | Foundation / learning / endgame checks |
| `teachTestRhythmValidator.js` | Max 2 teach blocks before interaction |
| `lessonFlowScore.js` | Architecture, retrieval, activity, duplication, exam scores |
| `activitySpacingEngine.js` | `conceptDistance` warnings |
| `duplicationAuditor.js` | Semantic + exact duplicates |
| `examReadinessEngine.js` | Application, exam, misconception, science extras |
| `lessonArchitectureDiagnostics.js` | Dev diagnostics payload |
| `lessonStructuralEnforcer.js` | Reorder + placeholders (no content rewrite) |
| `lessonGeneratorV3/index.js` | Orchestration entry |

## Enable

- `LESSON_GENERATOR_V3=true`
- Request: `useLessonGeneratorV3: true` (UI: **Enforce structure with V3**, requires V2 checkbox)
- Quality gate strict by default; `LESSON_GENERATOR_V3_STRICT=false` to log only

## Quality gate (before save)

Blocks export when any of these fail (default thresholds = 70):

- `architectureScore`
- `retrievalScore`
- `duplicationScore`

Returns `422` with `LESSON_ARCHITECTURE_GATE` and `flowScore` / `architectureDiagnostics` in dev.

## Tests

```bash
npm test -- tests/goldenArchitecture/architecture.golden.test.js
```

## Stable systems (unchanged)

Diagram, drag-drop, text-to-image, step-by-step, hotspot, graph rendering, student view, export schema v1.
