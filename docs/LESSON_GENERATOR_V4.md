# Lesson Generator V4 — Teaching Intelligence Layer (10/10 polish)

V4 sits **on top of** V2 (blueprint planning) and V3 (architecture enforcement). It does **not** replace them or change block renderers, export schema, or interactive systems.

**Refined goal:** Premium GCSE teacher-led lessons — narrative flow, examiner brain, concept chains, stepped worked examples — not organised AI blocks.

## Purpose

Combine:

- Curated LetsRevise teaching quality (narrative, examiner language, spiral retrieval)
- V2 learning journey blueprints
- V3 structural enforcement

## Modules (`lib/lessonGeneratorV4/`)

| Module | Role |
|--------|------|
| `teachingJourneyEngine.js` | Hook, prior bridge, progression, linking, recap |
| `explanationQualityEngine.js` | WHAT / HOW / WHY scoring; flags shallow/generic text |
| `examinerIntelligenceEngine.js` | Students often write / AQA expects / model answers |
| `retrievalJourneyEngine.js` | Spiral checkpoint progression |
| `activityDepthEngine.js` | Recall → understanding → application → exam thinking |
| `workedExampleEngine.js` | Worked example, walkthrough, model answer coverage |
| `teacherVoiceEngine.js` | Teacher phrases vs generic AI tone |
| `lessonTeachingDiagnostics.js` | Strengths, gaps, scores |
| `qualityGateV2.js` | 9/10+ tier requires sub-scores > 80 |
| `conceptStorytellingEngine.js` | Hook, analogy, links — not textbook-only |
| `coreLearningStructureEngine.js` | Big idea → What happens → Why → AQA → Trap → Quick check |
| `examinerBrainEngine.js` | Students often write / AQA wants / Better answer / Full-mark phrase |
| `conceptLinkingEngine.js` | Glucose → ATP → anabolism chains + bridges |
| `higherTierChallengeEngine.js` | Predict, explain, compare, apply stems |
| `modelAnswerQualityEngine.js` | Reveal answers + why marks awarded |
| `teacherTransitionEngine.js` | Short bridges between concepts |
| `tenOutOfTenRubric.js` | 10 pedagogical dimensions × /10 |
| `goldenMetabolismComparison.js` | Curated Metabolism benchmark |
| `premiumTeachingPrompt.js` | Combined generation appendix |
| `pipeline.js` | Orchestration + analysis |

## Flow score V2

`lib/lessonFlowScore.js` → `computeLessonFlowScoreV2()` adds:

- `teachingFlowScore`
- `explanationScore`
- `examReadinessScore` (blend of V3 + V4 examiner analysis)
- `retrievalJourneyScore`
- `teacherVoiceScore`
- `overallTeachingScore`

## Quality Gate V2

### 10/10 rubric

`scoreTenOutOfTenRubric()` scores: teaching clarity, concept storytelling, explanation depth, examiner thinking, retrieval progression, activity depth, worked examples, concept linking, higher tier challenge, final exam readiness.

**10/10 only if:** no category below **8/10**, average ≥ **9**.

### Quality Gate V2

A lesson cannot reach **premium (10/10)** unless all of:

- Teaching flow > 80
- Explanation > 80
- Exam readiness > 80
- Retrieval journey > 80
- Architecture > 80

Strict blocking export: `lessonGeneratorV4Strict: true` or `LESSON_GENERATOR_V4_STRICT=true`.

## Teacher Brain (Phase 2 — V4 prompt only)

When V4 builds the premium appendix, it runs `runTeacherBrain({ topic, subject, examBoard, tier })` and appends:

- Core concept chain
- Misconceptions
- Diagram briefs (text only — no image generation)
- Activity recommendations
- Exam targets (1/2/4/6 + Grade 9)
- Retrieval plan + memory hooks

Does **not** change V2/V3 block order. Unknown topics fall back to generic brain profile; missing topic skips the brain section.

## Teacher Brain Phase 3 — brief injection (V4 enabled)

After generation (with V4 on), `applyTeacherBrainBriefInjection` writes design briefs into the existing `note` field on:

- `interactiveDiagram`
- `dragDropMatch`
- `interactiveSequence`
- `hotspot` / label-style activities

Teachers see **DIAGRAM BRIEF**, **DRAG & DROP BRIEF**, or **STEP-BY-STEP BRIEF** text — no images, no schema changes. Student `intro` / `instructions` are unchanged.

**Edit Lesson UI:** When `note` starts with `--- TEACHER BRAIN DESIGN BRIEF ---`, the teacher editor shows a collapsible **Teacher Brain Design Brief** panel (with **Copy brief**) above activity fields, and the raw `note` textarea below for storage. Student view never renders `note`.

## API / UI

- **Teacher Dashboard** → Generate with AI: checkboxes V2 → V3 → **V4 Teaching intelligence**
- Request body: `useLessonGeneratorV4: true` (requires V2 blueprint for full prompt)
- Response may include `teachingDiagnostics`, `canAchievePremium`
- Error code: `LESSON_TEACHING_GATE` (422) when strict gate fails

## Environment

```bash
# LESSON_GENERATOR_V4=true
# LESSON_GENERATOR_V4_STRICT=true   # block save when teaching scores low
```

## SS1 generator (`components/GeneratorForm.jsx`)

V4 checkbox adds **prompt guidance** only. Full V4 scoring runs on `/api/ai/generate-and-save`.
