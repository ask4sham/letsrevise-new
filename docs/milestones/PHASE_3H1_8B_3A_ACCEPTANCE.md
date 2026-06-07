# Phase 3H.1.8b.3a — Worked Reasoning V2 Acceptance Rules

**Status:** Locked acceptance criteria — implementation must satisfy all rules before phase sign-off  
**Protected baseline:** `milestone-teacher-first-v1-recovery` (both repos)  
**Mode:** Prompt-only + read-only scoring — **no autofix, no content mutation**

---

## 1. Protected baseline

`milestone-teacher-first-v1-recovery` remains the recovery point for all regression checks.

| Repo | Tag | Restore |
|------|-----|---------|
| letsrevise-new | `milestone-teacher-first-v1-recovery` | `git checkout milestone-teacher-first-v1-recovery` |
| letsrevise-generator | `milestone-teacher-first-v1-recovery` | `git checkout milestone-teacher-first-v1-recovery` |

See `docs/milestones/TEACHER_FIRST_V1_RECOVERY.md` for full commit hashes and commands.

---

## 2. Forbidden modifications (hard fail if changed)

The following must remain **byte-for-byte behaviourally identical** when Worked Reasoning V2 flag is **OFF**, and must not be structurally altered when flag is **ON**:

| Area | Key modules (do not modify) |
|------|----------------------------|
| Teacher-First ordering | `teacherFirstSs1Architecture.js`, `lessonStructuralBlocks.js`, `dashboardTeacherFirstOpening.js` |
| Export pipeline | `buildGeneratorExportJson.js`, `lessonProductionPolish.js`, `lessonPresentationCleanup.js` |
| Import pipeline | `lessonGeneratorImport.ts`, `formatLessonBlockContent.ts`, `formatExamPracticeContent.ts` |
| Shell rendering | `teacherFirstSs1ShellEnforcer.js`, `normalizeToCanonicalSs1Shell` |
| Scope Authority | `objectivesAuthority.js`, `checkpointAuthority.js`, `examPracticeAuthority.js`, `summaryAuthority.js`, `scopeAuthorityLite.js` |
| Keyword Authority | `keyWordsAuthority.js` |
| Summary preservation | `summaryAuthority.js`, `ensureSummaryScopeLite` |

**Any PR touching these files for 3H.1.8b.3a is out of scope unless explicitly approved as a hotfix.**

---

## 3. Permitted Worked Reasoning V2 improvements

Worked Reasoning V2 may improve **content quality only** via prompt guidance and read-only scoring:

- Reasoning chains (cause → effect, step-linked explanations)
- Causal explanations (*because / therefore / so that / as a result*)
- 4–6 mark answer depth (marking-point thinking, not formatting)
- Examiner-style phrasing (precise GCSE terminology, direction of process)

---

## 4. Forbidden Worked Reasoning V2 constraints

Worked Reasoning V2 must **not** require or score against:

- Specific HTML structures (`<ol>`, `<details>`, `<h2>`, etc.)
- Ordered-list formatting
- Block layout templates
- Structural assumptions about how the model formats answers

### Revised prompt guidance (format-agnostic)

Prompt appendix instructs the model to:

- Use an exam-style **Question** stem with mark count in the Worked Example block
- Provide a **numbered or clearly sequenced** worked answer (plain text, bullets, or paragraphs acceptable)
- Include **≥ minSteps** linked marking-point sentences with causal connectors
- Model the topic's **primary reasoning chain** from `teachingQualityProfiles.js`

Prompt must **not** mandate HTML tags or SS1 paste-layout shapes.

### Revised read-only scoring (semantic only)

`scoreWorkedReasoningCoverage(text, profile)` extracts Worked Example **plain text** (strip tags) and checks:

| Signal | Detection (no HTML required) |
|--------|------------------------------|
| Worked Example present | SS1 block span or export block with `workedExample` role/kind |
| Question stem | Plain text contains `?` or `marks)` or command word from profile |
| Sequenced marking points | ≥ `minSteps` numbered lines (`1.` / `1)` / `Step 1`) **or** ≥ `minSteps` bullet lines **or** ≥ `minSteps` sentences with causal connectors |
| Causal depth | ≥ 2 matches of *because / therefore / so that / as a result / this means* in Worked Example body |
| Chain coverage | ≥ 50% of primary `reasoningChain` step tokens (length > 4) found in Worked Example plain text |
| Marking-point themes | ≥ 50% of `markingPointLabels` key tokens present (semantic, not exact label match) |

**Pass:** all signals true. Scorer returns `{ pass, signals, violations }` only — never mutates lesson text.

---

## 5. Acceptance generation pack (before sign-off)

Generate **one fresh lesson per topic** with flags:

```
TEACHER_BRAIN_TEACHER_FIRST_OPENING=1
TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE=1
TEACHER_BRAIN_WORKED_REASONING_V2=1
```

| Topic | Profile key | Acceptance label |
|-------|-------------|------------------|
| Nervous System | `nervous-system-structure` | Structure and function of the nervous system |
| Homeostasis | `homeostasis` | Homeostasis (or profile display name) |
| The Eye | `the-eye` | The eye (or profile display name) |

Output: export JSON per topic + autofix pipeline text + import round-trip verification.

---

## 6. Hard-pass checklist (all required)

Any single failure = **phase not accepted**.

### Structural / pipeline (V1 baseline)

| # | Check | Verification |
|---|-------|--------------|
| A | Definition present, **block 3** | `teacherFirstExportPipeline.test.js` / export block index |
| B | Scenario present, **block 4** | Same |
| C | Keywords populated | Export keywords block non-empty; ≥ 8 terms |
| D | Summary populated | Summary block non-empty; no placeholder |
| E | Scope Authority preserved | `assessmentScopeAuthority.test.js` + topic drift scan |
| F | Export → Import parity | `teacherFirstExportPipeline.test.js` + `presentationPolishImport.test.ts` |
| G | Self-Check populated | Checkpoint/self-check has Q/A/explanation |
| H | Worked Example populated | Worked example block has question + answer content |
| I | Exam Technique populated | Exam technique block topic-specific, non-generic |
| J | Exam Practice populated | Q1–Q4 in scope; Q5 bound correctly |

### Worked Reasoning V2 (additive, read-only)

| # | Check | Verification |
|---|-------|--------------|
| K | Worked reasoning scorer pass | `scoreWorkedReasoningCoverage` pass on all 3 generated lessons |
| L | No forbidden file changes | `git diff milestone-teacher-first-v1-recovery` — only allowed paths |

### Allowed implementation paths for 3H.1.8b.3a

```
lib/teacherBrain/workedReasoningEngine.js          (new)
lib/teacherBrain/teachingQualityProfiles.js        (profile extension only)
lib/teacherBrain/teachingQualityUpgrade.js         (wire appendix + scorer)
lib/buildPrompt.js                                 (append when flag on)
lib/lessonGeneratorV4/teacherBrainPromptAppendix.js
tests/workedReasoningEngine.test.js                (new)
backend/scripts/manualAcceptance3H18b3a.mjs        (new — read-only report)
letsrevise-generator/                              (mirror of above)
```

---

## 7. Regression commands (must pass before acceptance)

```bash
# letsrevise-new
npx jest tests/teacherFirstExportPipeline.test.js \
         tests/assessmentScopeAuthority.test.js \
         tests/objectivesAuthority.test.js \
         tests/presentationPolishImport.test.ts

# letsrevise-generator
node lib/teacherFirstExportPipeline.test.js
node lib/scopeAuthorityLite.test.js
node lib/presentationPolishExport.test.js

# 3H.1.8b.3a pack (after implementation)
node backend/scripts/manualAcceptance3H18b3a.mjs
```

---

## 8. Sign-off criteria

Phase **3H.1.8b.3a** is accepted only when:

1. All rules in sections 1–4 are satisfied  
2. Three-topic generation pack (section 5) completes without error  
3. All hard-pass checks (section 6) pass  
4. Regression suite (section 7) is green  
5. Manual rubric review confirms worked-reasoning quality improvement (NS / Homeostasis / Eye)

Until all five are true, the phase remains **not accepted**.
