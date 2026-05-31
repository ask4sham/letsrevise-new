# Lesson Generator V2 — Learning Experience Generator

V2 is a **planning/orchestration** upgrade. It does not change student-facing block renderers, export schema, or diagram/DDM layouts.

## Enable

- **Environment:** `LESSON_GENERATOR_V2=true` (server-wide default-on when set)
- **Per request:** `useLessonGeneratorV2: true` in `POST /api/ai/generate-and-save`
- **UI:** Teacher dashboard → “Generate lesson with AI” → **Generate with V2 planner**

V1 remains the fallback when the flag/toggle is off.

## Pipeline order

1. Topic classification (`lib/lessonGeneratorV2/archetypes.js`)
2. Knowledge graph (`lessonKnowledgeGraph.js`)
3. Lesson blueprint (`lessonBlueprintEngine.js`)
4. Learning journey (`learningJourneyPlanner.js`)
5. Activity placement (`activityPlacementEngine.js`)
6. Retrieval planning (`retrievalPlanner.js`)
7. Block generation (existing OpenAI path; blueprint appendix injected into prompt)
8. Pedagogical activity validation (existing)
9. GCSE calibration (existing)
10. Export polish (must **not** reorder blocks vs blueprint)
11. Golden snapshot validation (tests)

**Blueprint is the source of truth for block order** once generation follows the journey appendix.

## Optional refactor (existing lessons)

`POST /api/ai/refactor-lesson-v2` with `{ lessonId }` — **teacher opt-in only**. Reorders existing blocks to match the blueprint; does not auto-run on save.

## Dev diagnostics

When `NODE_ENV !== production`, `generate-and-save` may return `blueprintDiagnostics` (concepts, archetype, activity placement, retrieval spacing, under-tested concepts, block placement rationale).

## Modules

| Module | Role |
|--------|------|
| `lessonBlueprintEngine.js` | Assembles full blueprint object |
| `lessonKnowledgeGraph.js` | 4–7 concepts per topic |
| `learningJourneyPlanner.js` | Teach→test rhythm |
| `lessonChunkingRules.js` | Word limits, retrieval spacing |
| `activityPlacementEngine.js` | Archetype-specific activities |
| `retrievalPlanner.js` | Immediate / delayed / mastery retrieval |
| `lessonDuplicationGuard.js` | Duplicate question detection |
| `lessonLengthBudget.js` | quick / standard / deep / exam |
| `masteryProgressPlan.js` | Planned mastery metadata |
| `lessonRefactorEngine.js` | Reorder existing lessons |
| `blueprintDiagnostics.js` | Dev explanations |
| `pipeline.js` | Orchestration entry |

## Tests

```bash
npm test -- lib/__tests__/lessonGeneratorV2.golden.test.js
```

Golden topics: Metabolism, Uses of glucose, Limiting factors, Respiration, Plant defences.

## Regression safety

Do not change: diagram layout/reveal, DDM side-by-side + labels-under-image, card magnify, text-to-image layout, step-by-step spacing, graph/hotspot rendering, structural foundation blocks, export schema v1.
