# AI Lesson Generation — Strict Taxonomy Scoping Audit

**Purpose:** Ensure AI lesson generation stays within the chosen sub-topic (e.g. "Cell structure" only, not neighbouring sub-topics like diffusion, mitosis).

**Last updated:** 2025-03-05

---

## 1. Generation Entry Points

| Entry Point | Route / Source | Inputs | topicKey / specKey Source | Retrieval Scoping | Prompt Guardrails | Validation |
|------------|----------------|--------|---------------------------|-------------------|-------------------|------------|
| **Dashboard "Generate lesson materials"** | `POST /api/ai/generate-and-save` | topic, subject, level, board, tier, topicKey?, autoGenerateFromBanks | topicKey from selection or topic string; specKey from boardSubjectToSpecKey or parseTopicKey | getSpecPointsForTopic, getPastPaperSnippetsForTopic, knowledgeSearchService (exact topicKey) | buildUserPromptFromMd adds STRICT SCOPE section when subTopicDisplay/topicKey set | validateGeneratedContentAgainstTopic after merge |
| **Starter pack** | `POST /api/generate/starter-pack` | specKey, topicKey, statementCodes, tier | Request body | searchKnowledge with exact topicKey | LLM provider: STRICT SCOPE in generateStarterPack | — |
| **Weak evidence fix** | `POST /api/generate/weak-evidence-fix` | specKey, topicKey, statementCodes?, allowExternal? | Request body | searchKnowledge with exact topicKey | LLM provider: STRICT SCOPE in generateWeakEvidenceFixPack | — |
| **Practice set** | `POST /api/generate/practice-set` | specKey, topicKey, counts?, allowExternal? | Request body | searchKnowledge with exact topicKey | LLM provider: STRICT SCOPE in generatePracticeSet | — |
| **Topic summary → lesson** | Driven by topicSummaryLogId | From TopicSummaryLog | Topic from summary log at creation time | Context from log | Via buildUserPromptFromMd if topicKey available | — |

---

## 2. Generate-and-Save Flow (Dashboard)

### Inputs and Derivation

- **topicKey**: From request `topicKey` (trimmed) or resolved from `topic` string via `resolveSpecAndTopicKey`.
- **canonicalTopicKey**: Parsed from request; if invalid for spec, returns 400.
- **specKey**: `boardSubjectToSpecKey(board, subject)` or `parseTopicKey(topicKey).specKey`.
- **Validation**: `isValidTopicForSpec(specKey, canonicalTopicKey)` before generation.

### Retrieval

- `getSpecPointsForTopic(specKey, canonicalTopicKey)` — exact topicKey.
- `getPastPaperSnippetsForTopic(specKey, canonicalTopicKey, 5, PastPaperQuestion)` — exact topicKey.
- `knowledgeSearchService.searchKnowledge` (via generateSanitizedDraft / syllabusAlignment) — exact topicKey in Mongo query.

### Prompt Guardrails

- `buildUserPromptFromMd` adds a STRICT SCOPE section when `subTopicDisplay` or `topicKey` is set:
  - Only generate for selected sub-topic.
  - Do NOT include neighbouring sub-topics (examples: mitosis, diffusion, osmosis, stem cells for cell structure).
  - If evidence limited, stay within sub-topic.

### Post-Generation

- `validateGeneratedContentAgainstTopic` runs on merged `pagesMerged` when `canonicalTopicKey` present.
- `thinCoverage` set when `specPoints.length === 0`.
- Response includes `thinCoverage: true` and `warning` when applicable.

---

## 3. Starter Pack / Weak Evidence Fix / Practice Set

### Retrieval

- `knowledgeSearchService.searchKnowledge`: Mongo query uses `topicKey = String(topicKey).trim()` (exact match).

### Prompt Guardrails (LLM Provider)

- **generateStarterPack**: STRICT SCOPE — generate only for selected sub-topic; no neighbouring sub-topics.
- **generateWeakEvidenceFixPack**: STRICT SCOPE — same; if evidence limited, stay within sub-topic.
- **generatePracticeSet**: STRICT SCOPE — same.

---

## 4. Topic Drift Validation

**File:** `backend/utils/topicDriftValidation.js`

- `validateGeneratedContentAgainstTopic(opts)`: Detects strong drift into sibling sub-topics using keyword-based phrases.
- `getSiblingTopicKeysAndKeywords(topicKey, specKey)` from `topicTaxonomy` provides sibling keys.
- `buildStrongDriftPhrases(siblingKeys)` maps sibling keys to whole-word/phrase signals.
- Validation runs on: `pages`, `textBlocks`, `quizItems`, `flashcards`, `examQuestions`.

---

## 5. Response Fields (generate-and-save)

| Field | When | Purpose |
|-------|------|---------|
| `lessonId` | Always | Saved lesson ID |
| `thinCoverage` | specPoints.length === 0 | API consumers can show “limited coverage” UI |
| `warning` | thinCoverage or drift | Human-readable message; passed to EditLessonPage via navigate state |

---

## 6. Frontend

- **TeacherDashboard**: Sends `topicKey` when selected via `CreateLessonTopicSelectors`.
- **UI helper text**: “AI will generate content only for the selected sub-topic.” when topicKey is set.
- **EditLessonPage**: Displays `generationWarning` from navigate state.

---

## 7. Regression Tests

- **topicDriftValidation.test.js**: Unit tests for drift detection (cell-structure vs mitosis, osmosis, stem cells; biodiversity vs deforestation).
- **aiGenerateLesson.integration.test.js**: Tests generate-lesson endpoint (different from generate-and-save).

---

## 8. Key Paths

- `backend/routes/ai.js` — generate-and-save, buildUserPromptFromMd, generateSanitizedDraft
- `backend/utils/topicDriftValidation.js` — validateGeneratedContentAgainstTopic
- `backend/utils/topicTaxonomy.js` — getSiblingTopicKeysAndKeywords, findTopicBySpecAndKey
- `backend/services/knowledge/knowledgeSearchService.js` — exact topicKey filter
- `backend/services/syllabusAlignment.js` — getSpecPointsForTopic, getPastPaperSnippetsForTopic
- `backend/services/llm/provider.js` — STRICT SCOPE in starter-pack, weak-evidence-fix, practice-set prompts
- `frontend/src/pages/TeacherDashboard.tsx` — AI modal, topicKey payload
- `frontend/src/pages/EditLessonPage.tsx` — generationWarning display
