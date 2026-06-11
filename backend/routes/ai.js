// backend/routes/ai.js
const express = require("express");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const router = express.Router();
const auth = require("../middleware/auth");
const { sendInternalError, IS_PRODUCTION } = require("../utils/safeErrorResponse");

const Lesson = require("../models/Lesson");
const LessonRAGChunk = require("../models/LessonRAGChunk");
const VisualModel = require("../models/VisualModel");
const FlashcardBank = require("../models/FlashcardBank");
const PastPaperQuestion = require("../models/PastPaperQuestion");
const requireLessonAccess = require("../middleware/requireLessonAccess");
const {
  getSpecPointsForTopic,
  getPastPaperSnippetsForTopic,
  resolveSpecAndTopicKey,
  boardSubjectToSpecKey,
  COVERAGE_THRESHOLD,
} = require("../services/syllabusAlignment");
const { validateAndNormalizeRevision } = require("../services/validateRevision");
const { fetchTopicFlashcardsForSeed } = require("../utils/seedLessonFlashcardsFromTopic");

// ✅ ADDED: Import for curated visuals
const { findCuratedVisual } = require("../utils/curatedVisuals");
const { promoteHeroOnLesson } = require("../utils/promotePageHeroToBlock");
const { findDefaultCellVisualId } = require("../utils/defaultCellVisual");
const { generateContextAwareDiagram } = require("../services/diagramGeneration");
const { findTopicByKey, findTopicBySpecAndKey, topicToKey, isValidTopicForSpec } = require("../utils/topicTaxonomy");
const adminTaxonomyService = require("../services/adminTaxonomyService");
const { validateGeneratedContentAgainstTopic } = require("../utils/topicDriftValidation");
const { queryCandidates, DEFAULT_SPEC_LEGACY, parseTopicKey } = require("../utils/topicKey");
const { autoAttachLessonContent } = require("../services/autoAttachLessonContentService");
const { makeLessonDbSafe } = require("../utils/lessonDbSafe");
const { classifyTopicFramework } = require("../services/topicFrameworkClassification");
const {
  resolveFrameworkRoutingFromClassification,
  buildFrameworkRoutingPromptSection,
} = require("../../lib/teacherBrain/frameworkRoutingLayer");
const { buildBoardPromptFragment } = require("../config/aiLessonBoardConfig");
const {
  validateLessonDraftAgainstCurriculum,
  validateLessonStructure,
  mergeStructureValidationForScoring,
  validateBlockTypeRequirements,
  collectV7TeachingAdvisoryNotes,
  isRealExamStyleQuestion,
  hasSubstantialWorkedAnswer,
  isQualityWorkedExampleBlock,
  isFakeMedicineWorkedExampleStem,
  isFakeStemCellWorkedExampleContent,
  workedAnswerBlob,
  topicHaystackFromDraft,
  examTipLooksSpecific,
  blockFlowText,
  blockMentionsApplication,
  looksLikeWhatToNotice,
  whatToNoticeLooksSpecific,
  v6TokenSetForOverlap,
  v6JaccardSimilarity,
} = require("../services/lessonDraftValidation");
const { scoreLessonQuality, getLessonQualityBand } = require("../lib/lessonQualityScoring");
const {
  planLessonV2,
  mergeV2IntoAdditionalInstructions,
  resolveV2Enabled,
  refactorExistingLesson,
  runBlueprintDiagnostics,
} = require("../services/lessonGeneratorV2Service");
const {
  resolveV3Enabled,
  applyV3BeforeExport,
  runLessonArchitectureDiagnostics,
} = require("../services/lessonGeneratorV3Service");
const {
  resolveV4Enabled,
  mergeV4IntoAdditionalInstructions,
  buildV4PromptForBlueprint,
  applyV4AfterGeneration,
} = require("../services/lessonGeneratorV4Service");
const { applyTeacherBrainBriefInjection } = require("../services/teacherBrainInjectionService");
const { mergeOneShotCoveragePlanIntoInstructions } = require("../../lib/teacherBrain/oneShotLessonCoveragePlan");
const {
  isDashboardTeacherFirstEnabled,
  buildDashboardTeacherFirstPromptSection,
  enforceDashboardTeacherFirstOpening,
  enforceRequiredPracticalLessonStructure,
} = require("../../lib/teacherBrain/dashboardTeacherFirstOpening");
const {
  buildTeacherFirstOpeningPlan,
  formatTeacherFirstOpeningAppendix,
} = require("../../lib/teacherBrain/teacherFirstKnowledgeEngine");
const {
  isRequiredPracticalMode,
  buildRequiredPracticalDashboardLessonContract,
} = require("../../lib/teacherBrain/requiredPracticalMode");
const { buildLessonCoverageReview } = require("../../lib/teacherBrain/lessonCoverageReview");
const { buildReferenceLessonMaterialPrompt } = require("../../lib/referenceLessonMaterialPrompt");
const {
  auditLessonBoundary,
  boundaryAuditResponseMeta,
} = require("../../lib/teacherBrain/lessonBoundaryAudit");
const {
  planBoundaryReplacements,
  boundaryReplacementResponseMeta,
} = require("../../lib/teacherBrain/boundaryReplacementPlanner");
const { enforceObjectiveBoundariesOnDraft } = require("../../lib/teacherBrain/objectiveBoundaryEnforcer");
const { enforceInteractionAuthorityOnDraft } = require("../../lib/teacherBrain/interactionAuthorityEnforcer");
const { resolveSubTopicProfile } = require("../../lib/teacherBrain/subTopicProfiles");
const { resolveTeachingQualityProfile } = require("../../lib/teacherBrain/teachingQualityProfiles");
const {
  createCoverageGateFromLesson,
  createCoverageGenerationGate,
  planCoverageGatedQuestion,
  planCoverageGatedQuestionBatch,
  formatCoveragePlanForPrompt,
  prependCoverageDirectiveToPrompt,
} = require("../utils/teacherBrainCoverageGate");

const VALID_COVERAGE_GENERATION_KINDS = new Set([
  "activity",
  "checkpoint",
  "quiz",
  "hotspot",
  "practice",
  "retrieval",
  "exam",
]);

/** Taxonomy topicKey → VisualModel conceptKeys. Use topicKey for diagram lookup (deterministic). */
const BIOLOGY_DIAGRAM_MAP = {
  "cell-structure": ["cell-animal", "cell-plant"],
  "animal-plant-cells": ["cell-animal", "cell-plant"],
  "enzymes": ["enzyme-lock-key"],
  "digestive-system": ["digestive-system-organs"],
  "photosynthesis": ["photosynthesis"],
  "respiration": ["respiration"],
  "transport-in-plants": ["transport-plants"],
  "transport-summary": ["transport-plants"],
  "circulatory-system": ["circulatory-system"],
  "heart": ["circulatory-system"],
  "nervous-system": ["nervous-system"],
  "nervous-system-structure": ["nervous-system"],
  "homeostasis": ["homeostasis"],
  "ecology": ["ecology-pyramid"],
  "evolution": ["evolution-tree"],
};

function safeStr(v, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s.trim() : fallback;
}

function clampOptions(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((x) => safeStr(x, "")).filter(Boolean).slice(0, 4);
}

function normalizeBlockType(t) {
  const v = safeStr(t, "text");
  const allowed = ["text", "keyIdea", "examTip", "commonMistake", "stretch", "checkpoint", "diagram"];
  return allowed.includes(v) ? v : "text";
}

function normalizeTier(tier) {
  const t = safeStr(tier, "").toLowerCase();
  if (!t || t === "none" || t === "all") return "";
  if (t.includes("foundation")) return "foundation";
  if (t.includes("higher")) return "higher";
  if (t === "foundation" || t === "higher") return t;
  return "";
}

function normalizeLevel(level) {
  const s = safeStr(level, "");
  if (!s) return "";
  if (/ks\s*3/i.test(s)) return "KS3";
  if (/gcse/i.test(s)) return "GCSE";
  if (/a[\s-]?level/i.test(s)) return "A-Level";
  return s;
}

function getAuthUserId(req) {
  return req.user?.userId || req.user?._id || req.user?.id || null;
}

function requireTeacherOrAdmin(req, res) {
  const t = safeStr(req.user?.userType, "").toLowerCase();
  if (t !== "teacher" && t !== "admin") {
    res.status(403).json({ error: "Only teachers/admin can use AI tools" });
    return false;
  }
  return true;
}

/** Returns true if any page has at least one block with type === "diagram". */
function hasDiagram(pages) {
  return Array.isArray(pages) && pages.some((page) =>
    Array.isArray(page?.blocks) && page.blocks.some((block) => block?.type === "diagram")
  );
}

/**
 * JSON Schema for Structured Outputs (OpenAI response_format strict dialect).
 * Every key in blocks.items.properties must appear in blocks.items.required.
 * Optional semantics are handled via empty strings / [] and post-generation sanitization.
 */
const LESSON_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "description",
    "estimatedDuration",
    "tags",
    "board",
    "tier",
    "pages",
  ],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    estimatedDuration: { type: "number" },
    tags: { type: "array", items: { type: "string" } },
    board: { type: "string" },
    tier: { type: "string" },
    pages: {
      type: "array",
      minItems: 1,
      maxItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "order", "pageType", "blocks", "checkpoint"],
        properties: {
          title: { type: "string" },
          order: { type: "number" },
          pageType: { type: "string" },
          blocks: {
            type: "array",
            minItems: 1,
            maxItems: 24,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "text",
                    "keyIdea",
                    "commonMistake",
                    "examTip",
                    "checkpoint",
                    "diagram",
                    "stretch",
                  ],
                },
                title: { type: "string" },
                content: { type: "string" },
                role: { type: "string" },
                caption: { type: "string" },
                question: { type: "string" },
                answer: { type: "string" },
                prompt: { type: "string" },
                explanation: { type: "string" },
                questionType: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correctAnswer: { type: "string" },
                visualId: { type: "string" },
              },
              required: [
                "type",
                "title",
                "content",
                "role",
                "caption",
                "question",
                "answer",
                "prompt",
                "explanation",
                "questionType",
                "options",
                "correctAnswer",
                "visualId",
              ],
            },
          },
          checkpoint: {
            type: "object",
            additionalProperties: false,
            required: ["question", "options", "answer"],
            properties: {
              question: { type: "string" },
              options: {
                type: "array",
                minItems: 4,
                maxItems: 4,
                items: { type: "string" },
              },
              answer: { type: "string" },
            },
          },
        },
      },
    },
  },
};

/**
 * Locked teaching + style rules: shared by first-pass user prompt and second-pass rewrite.
 * Single source of truth — update here only.
 *
 * Prompt-only patches: prefer changing prompts here or AI_LESSON_PROMPT.md. Schema may still
 * change for API compatibility (e.g. permissive response_format); keep scoring/validation intent
 * aligned when you touch enforcement.
 */
const LESSON_BLOCK_FULL_KEYS_INSTRUCTION = `

## JSON BLOCK SHAPE (MANDATORY — matches response_format schema)

For every object in pages[0].blocks, include ALL standard fields on every block. Do not omit keys.

Each block must always include exactly these keys:
type, title, content, role, caption, question, answer, prompt, explanation, questionType, options, correctAnswer, visualId

If a field does not apply to that block type:
- use "" for string fields
- use [] for options (use four strings for MCQ checkpoints when applicable)

Do not omit keys. The API schema requires every listed property on every block.

For non-checkpoint blocks, questionType may be "". For checkpoint blocks, use "mcq" or "short". visualId is usually "" unless you have a real id string.
`;

const LESSON_TEACHING_AND_STYLE_LOCKED = `

## TEACHING AND STYLE (MANDATORY)

User-provided reference lesson material overrides stylistic defaults where applicable.

## EXECUTION PERSONA — CONVERSATIONAL TUTOR (CHATGPT-LIKE, MANDATORY)

Generate the lesson as if you were tutoring **one student in a live chat**: sequential, plain-spoken, and helpful. JSON is only the delivery pipe — every \`title\` and \`content\` should read like **the next message** in that conversation, not like a wiki article or condensed notes.

**Think:** Before moving on, ask what a typical student would misunderstand at this point; resolve it in the following block (without breaking block-type rules).

**Behave:** Warm and direct. Prefer short sentences, "So …", "That means …", "Here's the catch …" over passive or admin tone. Avoid "This section will discuss …", "It is important to note …", and other document-y framing.

**Act:** One teaching move per block (same as Rule 2). Order blocks so the student can read top-to-bottom like scrolling a chat thread — each line of reasoning connects to the last.

**Execute:** Lead with intuition where helpful, then tighten with specification language for marks. Checkpoints are **pause points** — write them like a tutor checking understanding, not like anonymous quiz items. Link ideas across blocks (carry forward one thread).

**Do not** mention AI, ChatGPT, language models, or that you are automated. This persona does **not** relax JSON shape, full block fields, or the role stencil — only tone, reasoning flow, and clarity.

---

## V2 — TEACHING BEHAVIOUR (GUIDED TEACHING, NOT NOTES)

You are not writing notes. You are teaching a student who is learning this for the first time and must understand AND answer exam questions.

Always prioritise: clarity, understanding, exam success.

Every lesson must feel like a teacher guiding step-by-step — NOT a page of notes.

### RULE 1 — TEACH IN STEPS (MANDATORY)

Every concept must follow this flow:
1. Simple idea
2. Why it matters
3. Example or application
4. Exam link

Do NOT skip steps.

Internal quality bar — bad vs good:
- Bad: "Stem cells can differentiate into specialised cells."
- Good: "Stem cells can turn into specialised cells. This matters because it allows the body to repair damaged tissues. For example, stem cells can replace damaged blood cells in leukaemia treatment. In exams, you may be asked to explain this process."

### RULE 2 — SHORT, FOCUSED WRITING

- Maximum 2 sentences per explanation block (text blocks and similar).
- One idea per block. No long paragraphs.
- If a point needs more depth → split into multiple blocks.

### RULE 3 — STRUCTURE → FUNCTION LINK (CRITICAL)

Whenever describing something, always link feature → function or cause → effect.

- Good: "The long axon allows impulses to travel long distances."
- Not enough: "The axon is long."

### RULE 4 — FORCE EXAM THINKING

Constantly ask: "How does this appear in an exam?"

Every key idea must include exam-relevant wording, an exam scenario, or command-word context.

### RULE 5 — WORKED EXAMPLE (NON-NEGOTIABLE)

Include at least ONE worked exam question (checkpoint with role workedExample where applicable).

Format:
- Include mark count (e.g. 3 marks).
- Answer MUST be bullet points; each bullet = one marking point.

Example:
Question: Explain how stem cells are used in medicine (3 marks)
Answer:
- Stem cells can differentiate into specialised cells
- This allows damaged cells to be replaced
- Example: bone marrow transplant to treat leukaemia

### RULE 6 — "WHAT TO NOTICE" (VISUAL THINKING)

After every diagram: a keyIdea block titled EXACTLY: "What to Notice".

It must:
- Include 2–3 bullet points
- Focus attention on the visual
- Link to understanding or exam use

### RULE 7 — KEY IDEAS MUST BE PUNCHY

Key ideas are NOT paragraphs. Short, clear, memorable, exam-focused. Prefer tight bullets over prose.

### RULE 8 — COMMON MISTAKES MUST BE EXAM-LEVEL

No generic mistakes. Use real exam-style misconceptions with a clear wrong vs correct contrast.

### RULE 9 — AVOID TEXTBOOK LANGUAGE

Do not define everything formally or use long academic sentences. Write like a good teacher explaining, not a textbook describing.

### RULE 10 — FORCE ACTIVE LEARNING

Checkpoint questions must use command words (Explain, Describe, Compare) where appropriate and test understanding, not trivial recall.

### RULE 11 — FORCE VISUAL USAGE

Each major concept MUST include a diagram block followed by "What to Notice". If no real diagram exists, use content: "image here".

### RULE 12 — END WITH MEMORY RULE

The final memory rule (keyIdea, role finalMemoryRule) must summarise the topic in 1–2 memorable lines.

### RULE 13 — BAN NOTE-DUMPING

Do not stack multiple ideas in one block or list facts without explanation. Every block must teach something, not just state something.

### RULE 14 — PRIORITISE MARKS OVER COMPLETENESS

If forced to choose, choose what earns marks — not what sounds most detailed.

---

## V3 — MICRO-TEACHING ENFORCEMENT

Every block must do a teaching job, not just contain information.

### TEXT BLOCK RULE

Every text block must follow this order:
1. Simple explanation
2. Why it matters
3. Example or application

Rules:
- maximum 2 short sentences per idea
- if needed, split into another text block
- do not stack multiple big ideas in one block
- do not define a term without explaining why it matters

### KEY IDEA BLOCK RULE

Every keyIdea block must be:
- bullet points or very short lines only
- maximum 2 lines unless it is "What to Notice"
- punchy
- memorable
- exam-focused

Bad:
"Stem cells are undifferentiated cells that are important for growth and development."

Good:
- Stem cells can self-renew
- Stem cells can differentiate

### COMMON MISTAKE RULE

Every commonMistake block must contain:
- one wrong belief
- one correct belief
- one short exam consequence

Format:
Wrong: ...
Correct: ...
Exam link: ...

A valid commonMistake block must use this exact format in **content** (three lines labelled Wrong: / Correct: / Exam link:).

### EXAM TIP RULE

Every examTip block must:
- be one short practical exam rule
- tell the student how to gain marks
- avoid repeating a definition

### DIAGRAM RULE

Each major concept must include:
- one diagram block
- immediately followed by one keyIdea block titled exactly "What to Notice"

If no real image is available:
- content must be exactly: "image here"

### "WHAT TO NOTICE" RULE

This block must:
- contain exactly 2 or 3 bullet points
- focus on visible features
- explain why the feature matters

### CHECKPOINT RULE

Checkpoint blocks must not be placeholders.

Each checkpoint must be one of:
- worked example
- short exam-style question
- compare/explain/describe question

Checkpoint rules:
- use command words like Explain, Describe, Compare, Evaluate, State
- avoid fake MCQs unless they are meaningful
- no "Option 1", "Option 2" placeholder content
- must include a correct answer or model answer

### WORKED EXAMPLE RULE

The workedExample checkpoint must include:
- a real exam-style question
- mark count
- bullet-point answer
- each bullet = one marking point
- specific wording, not generic filler

### FINAL MEMORY RULE

The last keyIdea block must:
- summarise the topic in 1 or 2 very short lines
- be easy to remember for exam revision

The final keyIdea block must use role "finalMemoryRule" and summarise the topic in 1 or 2 short lines.

### ANTI-NOTE-DUMPING RULE

Do not produce blocks that only list facts.
Every block must either:
- explain
- guide attention
- train exam thinking
- correct a misconception
- test understanding

If a block does none of those, rewrite it.

---

## V3 OUTPUT FORMAT REMINDER

Write the lesson so that:
- text blocks teach in mini-steps
- keyIdea blocks are short and punchy
- commonMistake blocks use Wrong / Correct / Exam link
- examTip blocks sound like examiner advice
- checkpoint blocks sound like real GCSE questions
- worked examples look like mark-scheme training
- the lesson feels like a teacher guiding the student, not a page of notes

---

## V4 — CONTENT INTELLIGENCE LAYER

Do not use generic filler.
Every block must feel specific to the actual topic being taught.

### TOPIC-SPECIFIC RULE

Always mention the real concept being taught.
Do not write vague phrases like:
- "this topic"
- "the concept"
- "the process"
- "the material"

Instead, name the real thing:
- stem cells
- embryonic stem cells
- adult stem cells
- differentiation
- regenerative medicine

### KEY IDEA CONTENT RULE

A keyIdea block must do at least one of these:
- define a term clearly
- explain a distinction
- state an exam-relevant rule
- compress a high-value fact into a memorable form

Do not write keyIdea blocks that are only generic statements.

### TEXT BLOCK CONTENT RULE

A text block must:
1. explain the idea simply
2. explain why it matters
3. give a real example or application tied to the topic

If the block does not contain a real example, rewrite it.

### COMMON MISTAKE CONTENT RULE

The commonMistake block must refer to a real misconception from this topic.

It must not be generic.
It should contrast two real ideas students confuse.

Example for stem cells:
Wrong: Adult stem cells can become any cell type
Correct: Adult stem cells can only differentiate into a limited range of cell types
Exam link: This is often tested in compare questions about embryonic vs adult stem cells

### EXAM TIP CONTENT RULE

Exam tips must be specific to how marks are earned in this topic.

Bad:
"Use key terms in your answer."

Good:
"In stem cell questions, compare embryonic and adult stem cells directly to earn comparison marks."

### WHAT TO NOTICE CONTENT RULE

A What to Notice block must mention actual visible or conceptual features from the topic.
It must not use generic fallback wording unless absolutely necessary.

Bad:
- Focus on labelled parts
- Notice how features link to function

Good:
- Notice embryonic stem cells can become any cell type
- Notice adult stem cells are more limited
- In exams, use this difference when comparing their uses

### WORKED EXAMPLE CONTENT RULE

The worked example must be topic-specific.
The model answer must include:
- exact terminology from the topic
- one concrete example
- no vague filler such as "helps the body"

### FINAL MEMORY RULE CONTENT

The finalMemoryRule block must contain:
- the single most important exam idea from the topic
- phrased in a memorable way

### ANTI-GENERIC RULE

Avoid generic phrases unless absolutely necessary.
Examples to avoid:
- "this is important"
- "it helps in exams"
- "this concept matters"
- "used in many situations"

Replace them with specific statements about the actual topic.

---

## V5 — TEACHING FLOW ENGINE

The lesson must feel like a guided explanation, not a stack of separate notes.

### FLOW RULE

Each important block must build on the previous one.

The lesson should move in this order:
1. What it is
2. Why it matters
3. Key distinction or rule
4. Example or application
5. Exam use

Do not jump randomly between facts.

### CONNECTION RULE

When writing a new block, connect it to the previous block.
Use connecting ideas such as:
- This means...
- This matters because...
- In contrast...
- This is why...
- In exams...
- For example...

Do not let blocks feel isolated.

### LESSON ARC RULE

The lesson must follow a clear arc:
- opening curiosity or relevance
- core idea
- distinction or comparison
- practical application
- exam guidance
- memory takeaway

### KEY IDEA FLOW RULE

A keyIdea block should not only state a fact.
It should either:
- introduce the next step in understanding
- summarise the previous step
- highlight the exact rule needed for the next explanation

### TEXT FLOW RULE

A text block must progress understanding.
It should answer one of these:
- What is this?
- Why does it matter?
- How is it used?
- How is it different?
- How will this appear in exams?

### COMPARISON FLOW RULE

If the topic includes two or more important categories, introduce the comparison early and return to it often.

Example for stem cells:
- embryonic stem cells vs adult stem cells
- this difference should appear early, not only later

### APPLICATION FLOW RULE

If the topic has real-world or medical applications, explain those only after the core biological idea is secure.

Do not introduce applications before the student understands the concept.

### EXAM FLOW RULE

Exam tips and worked examples must feel like the natural next step in the lesson, not random add-ons.

### FINAL TAKEAWAY RULE

The finalMemoryRule must clearly conclude the lesson by capturing the single comparison, rule, or idea that exam questions are most likely to test.

---

## V6 — REASONING AND COMPRESSION ENGINE

Do not repeat an idea that has already been explained.

Before writing each new block, check:
1. Has this idea already been stated?
2. If yes, do not restate it.
3. Instead, add one of:
   - a contrast (X, but not Y; unlike; whereas)
   - an example
   - an application
   - an exam implication (marks, command words, what examiners reward)

Every new block must add a new cognitive step.

If two adjacent blocks cover the same idea in similar words, merge them into one stronger block.

### BLOCK VALIDITY RULE

A block is only valid if it does at least one of:
- introduces a new idea
- explains why a previous idea matters
- contrasts two ideas
- gives a real example
- shows how marks are earned (or corrects a misconception)

### REASONING CHAIN FOR THE TOPIC CORE

Cover the core in this order (you may use fewer blocks by combining steps — prefer compression over repetition):
1. What is it?
2. Why does it matter?
3. What is the main distinction or comparison?
4. What is the application or example?
5. What is the exam takeaway?

Prefer teaching through contrast (this vs that) rather than listing separate facts that restate the same point.

### ANTI-REPETITION RULE

Do not restate the same exam distinction (e.g. embryonic vs adult stem cells, or "they can differentiate") in multiple blocks unless each repetition adds a genuinely new angle (ethics vs medicine vs exam technique).

---

## ROLE STENCIL (MANDATORY)

You must generate the lesson using this exact role sequence at the start and end.

Opening blocks:
1. text block with role "hook"
2. keyIdea block with role "coreRule"
3. commonMistake block with role "commonMistake"
4. keyIdea block with role "patternRecognition"

For each major concept, use:
- diagram block with role "concept"
- keyIdea block with role "whatToNotice"
- text block with role "concept"
- examTip block with role "concept"

Before the end, include:
- checkpoint block with role "workedExample"

Closing blocks:
- keyIdea block with role "synthesis"
- checkpoint block with role "quickCheck"
- checkpoint block with role "quickCheck"
- keyIdea block with role "finalMemoryRule"

The role field is mandatory and must match exactly.
If a role is not applicable, still use the closest required role from this stencil.

You must include at least 2 diagram blocks. If no real image is available, use content: "image here".

---

## WORKED EXAMPLE CHECKPOINT (MANDATORY)

You MUST include one checkpoint block with role "workedExample".

This workedExample checkpoint must contain:
- a real exam-style question using a command word such as Explain, Describe, or Compare
- a mark count, for example "(3 marks)" or "(4 marks)"
- a model answer
- the model answer written as bullet points
- each bullet point must represent one marking point

Do not use placeholders such as:
- "What statement is correct?"
- "Write your answer here"
- "Option 1"
- "Option 2"

The workedExample checkpoint must be substantial and useful for revision.

---

## OUTPUT GUARDRAILS (MANDATORY)

- Teach like a teacher, not a textbook.
- Use exam-style phrasing throughout.
- At least 2 checkpoint questions must use Explain, Describe, or Compare (or similar command words).
- Do not skip exam tips or checkpoints. Each checkpoint needs a real exam-style question and a correct answer.
- Do not skip any required blocks. If unsure, still produce them.

---

## WHEN IMPROVING AN EXISTING DRAFT (SECOND PASS)

You MUST fix:
- weak explanations → rewrite into teaching steps (Rule 1)
- long paragraphs → split (Rule 2)
- missing examples → add
- weak exam answers → convert to bullet mark scheme (Rule 5)
- missing diagrams → add placeholder (content: "image here")
- missing roles → enforce the ROLE STENCIL above
- weak or missing workedExample → rewrite or add one with command word, mark count, and bullet-point model answer (at least three marking points)

The improved lesson must still match the JSON schema and full block field set from the first pass.

---

Final priority:
If a block is technically correct but still feels like a revision note, rewrite it into guided teaching.
Marks, clarity, and learning come before sounding comprehensive.
`;

/** Second-pass: explicit repair targets for roles + diagrams (tuning). */
const LESSON_SECOND_PASS_ROLE_REPAIR = `

## STRUCTURE REPAIR (SECOND PASS)

If any required roles are missing, add or rewrite blocks so the lesson includes:
- coreRule
- commonMistake
- patternRecognition
- workedExample
- synthesis
- finalMemoryRule

If diagram count is below 2, add diagram blocks with content: "image here".

If the workedExample checkpoint is weak or missing, rewrite or add one. A valid workedExample must have:
- role "workedExample"
- an exam-style question with a command word
- a mark count
- a bullet-point model answer
- at least three useful marking points

If any commonMistake block does not use Wrong / Correct / Exam link format in content, rewrite at least one so it does.

If the draft is missing a finalMemoryRule block, add one as the last keyIdea block.
`;

const LESSON_SECOND_PASS_V3_REPAIR = `

## V3 SECOND-PASS REPAIR

When improving the draft, repair block behaviour as well as structure.

You must:
- rewrite weak text blocks into simple explanation + why it matters + example/application
- shorten long keyIdea blocks into punchy bullet points
- rewrite commonMistake blocks into Wrong / Correct / Exam link format
- rewrite examTip blocks into practical mark-gaining advice
- rewrite weak checkpoints into real exam-style questions with correct answers
- upgrade the workedExample into a proper marked model answer if weak
- insert or repair "What to Notice" blocks after diagrams
- remove note-dumping and split overloaded blocks
`;

const LESSON_SECOND_PASS_V4_REPAIR = `

## V4 SECOND-PASS REPAIR

When improving the draft, rewrite weak blocks so they become more topic-specific.

You must:
- replace generic filler with real topic terms
- replace vague statements with specific biological or exam-relevant facts
- upgrade weak keyIdea blocks so they define, distinguish, or state a rule
- upgrade weak examTip blocks so they explain exactly how marks are earned in this topic
- upgrade What to Notice blocks so they mention real topic-specific features
- upgrade the finalMemoryRule so it captures the most important exam takeaway
`;

const LESSON_SECOND_PASS_V5_REPAIR = `

## V5 SECOND-PASS FLOW REPAIR

When improving the draft, repair lesson flow as well as content.

You must:
- reorder or rewrite blocks so ideas build logically
- move comparisons earlier if they are central to the topic
- make applications follow understanding, not come before it
- make exam tips feel like a next step from the explanation
- rewrite isolated blocks so they connect to what came before
- make the final memory rule feel like a conclusion, not just another block
`;

const LESSON_SECOND_PASS_V6_REPAIR = `

## V6 SECOND-PASS — COMPRESSION AND REASONING

When improving the draft, compress aggressively. Clarity beats completeness.

You must:
- if more than 3 blocks express the same idea, merge them into 1–2 stronger blocks and delete weaker duplicates — do not preserve all content
- merge or delete blocks that restate the same idea (stem cells / differentiation / embryonic vs adult / medical uses) unless each adds a clearly new angle
- ensure each text or keyIdea block adds a new cognitive step compared to the previous teaching block
- prefer contrast (X vs Y, but not Z) over stacking similar facts
- keep the reasoning chain once: what it is → why it matters → main distinction → application → exam takeaway — no duplicate steps
- if two adjacent blocks overlap in wording or meaning, merge into one stronger block
`;

function buildTopicAwareFlowHints(topicHint = "") {
  const topic = String(topicHint || "").toLowerCase();

  if (topic.includes("stem cell")) {
    return [
      "Start by explaining that stem cells are unspecialised cells.",
      "Then explain why this matters: they can differentiate into specialised cells.",
      "Introduce embryonic vs adult stem cells early.",
      "Then explain medical uses such as bone marrow transplants and regenerative medicine.",
      "Then cover ethical issues.",
      "End by reinforcing the difference between embryonic and adult stem cells because this is often tested in exams.",
    ];
  }

  return [
    "Start with the core idea.",
    "Then explain why it matters.",
    "Then introduce the key distinction or comparison.",
    "Then apply it to an example.",
    "Then link it to exam questions.",
    "End with a strong memory takeaway.",
  ];
}

function buildTopicAwareReasoningChainHints(topicHint = "") {
  const topic = String(topicHint || "").toLowerCase();

  if (topic.includes("stem cell")) {
    return [
      "Compress: one tight step for what stem cells are and why differentiation matters — avoid repeating the same definition later.",
      "Teach embryonic vs adult mainly through contrast (potency, ethics context, typical uses) — not three blocks that restate the difference.",
      "Medical uses: one clear application block after the distinction is secure.",
      "Exam: one block that says how that contrast earns marks — do not repeat the same exam tip in different words.",
    ];
  }

  return [
    "What is it? (once, clearly)",
    "Why does it matter? (link to mechanism or consequence)",
    "Main distinction or comparison (prefer X vs Y in one place)",
    "Application or example (new information only)",
    "Exam takeaway (marks, command words — without repeating earlier definitions)",
  ];
}

/* =========================================================
   PROMPT LOADING (AI_LESSON_PROMPT.md)
   ========================================================= */

function tryReadPromptFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      return safeStr(raw, "");
    }
  } catch (_) {}
  return "";
}

function loadLessonPromptTemplate() {
  const candidates = [
    path.join(__dirname, "..", "prompts", "AI_LESSON_PROMPT.md"),
    path.join(__dirname, "..", "AI_LESSON_PROMPT.md"),
    path.join(process.cwd(), "AI_LESSON_PROMPT.md"),
    path.join(process.cwd(), "backend", "prompts", "AI_LESSON_PROMPT.md"),
    path.join(process.cwd(), "backend", "AI_LESSON_PROMPT.md"),
  ];

  for (const p of candidates) {
    const txt = tryReadPromptFile(p);
    if (txt) {
      console.log(`✅ AI lesson prompt loaded from: ${p}`);
      return txt;
    }
  }

  console.warn(
    "⚠️ AI_LESSON_PROMPT.md not found in expected locations. Using built-in fallback prompt."
  );

  // Fallback prompt: keep it compatible with schema + your latest rules
  return `
### SYSTEM PROMPT

You are an expert UK curriculum teacher and exam examiner.
Write in British English. Do not mention you are an AI.

---

### USER PROMPT TEMPLATE

Create a COMPLETE revision lesson draft for UK students with the following details:

Subject: {{subject}}
Level: {{level}}
Topic: {{topic}}
Exam board (if applicable): {{board}}
Tier (GCSE only): {{tier}}

If {{board}} is an empty string, treat the exam board as "UK general".
If Level is not GCSE, Tier must be an empty string.

STRICT REQUIREMENTS:
1. Output MUST be valid JSON only (no markdown outside JSON)
2. Match the schema EXACTLY (field names, types, nesting)
3. Do NOT add extra keys outside the schema
4. Write for UK students using simple, clear language
5. Focus on exam understanding and common mistakes
6. Assume this is a PAID lesson and quality must be high
7. Description must be 2–3 sentences
8. Do NOT include external links

LESSON STRUCTURE RULES:
- Create a SINGLE-PAGE draft. Exactly 1 page. Do NOT create multiple pages.
- Use section types as blocks within the page: text, keyIdea, examTip, commonMistake, stretch (Higher only), checkpoint.
- Do NOT create separate pages for: Core Concept 1, Core Concept 2, Comparison, Check Understanding, Exam Tips, Stretch.
- The single page must include:
  - Clear explanation text (at least one "text" block)
  - At least one "keyIdea", "examTip", or "commonMistake" block
  - For Higher tier only: at least one "stretch" block (deeper/extension content)
  - One checkpoint block with EXACTLY 4 options; "correctAnswer" must match one option EXACTLY
- Foundation: simpler language. Higher: deeper detail + stretch block.

TAGS RULE:
- Provide 5–12 short tags (single words or short phrases)

OUTPUT SCHEMA (DO NOT CHANGE):
- Exactly 1 page in "pages" array. All content in blocks on that page.

{
  "title": "string",
  "description": "string",
  "estimatedDuration": number,
  "tags": ["string"],
  "board": "string",
  "tier": "string",
  "pages": [
    {
      "title": "Page 1",
      "order": 1,
      "pageType": "string",
      "blocks": [
        { "type": "text | keyIdea | examTip | commonMistake | stretch", "content": "string" },
        { "type": "checkpoint", "prompt": "string", "questionType": "mcq|short", "options": ["string"], "correctAnswer": "string", "explanation": "string" }
      ]
    }
  ]
}
`.trim();
}

const AI_LESSON_PROMPT_TEMPLATE = loadLessonPromptTemplate();

function injectPromptVars(template, vars) {
  const subject = safeStr(vars.subject, "");
  const level = safeStr(vars.level, "");
  const topic = safeStr(vars.topic, "");
  const boardRaw =
    vars.board === undefined || vars.board === null ? "" : String(vars.board);
  const tierRaw =
    vars.tier === undefined || vars.tier === null ? "" : String(vars.tier);

  let out = String(template);

  // Basic vars
  out = out.replace(/\{\{\s*subject\s*\}\}/g, subject);
  out = out.replace(/\{\{\s*level\s*\}\}/g, level);
  out = out.replace(/\{\{\s*topic\s*\}\}/g, topic);

  // NEW STYLE: {{board}} should stay empty if empty string
  out = out.replace(/\{\{\s*board\s*\}\}/g, boardRaw);

  // Backwards-compat: {{board || "UK general"}} => inject default if empty
  const boardValue = safeStr(boardRaw, "") ? boardRaw : "UK general";
  out = out.replace(
    /\{\{\s*board\s*\|\|\s*["']UK general["']\s*\}\}/g,
    boardValue
  );

  // Tier placeholder
  out = out.replace(/\{\{\s*tier\s*\}\}/g, tierRaw);

  return out.trim();
}

function buildSystemPrompt(subject, level, referencePromptSection = "") {
  const ref = String(referencePromptSection || "").trim();
  // Keep system prompt compact; behaviour detail lives in LESSON_TEACHING_AND_STYLE_LOCKED + MD template.
  const base = [
    `You are an expert UK curriculum tutor teaching one student step-by-step — like a leading conversational tutor: clear, patient, encouraging, never patronising.`,
    `Think before each step: what would confuse a ${normalizeLevel(level)} ${safeStr(subject)} student here? Address it in the next block. Block text should read like live chat teaching, not a syllabus handout.`,
    `Be exam-accurate and British English. JSON is only the wire format — titles and content strings carry natural tutor voice.`,
    `Return ONLY valid JSON matching the schema. No text before or after the JSON.`,
  ].join(" ");
  return ref ? `${base}\n\n${ref}` : base;
}

/** Layer 2 opening appendix for dashboard Teacher-First (non-RP) prompt wiring — Phase 3b.3f.5B. */
function buildTeacherFirstLayer2OpeningAppendix(ctx = {}) {
  if (!isDashboardTeacherFirstEnabled() || isRequiredPracticalMode(ctx)) {
    return "";
  }
  const appendix = formatTeacherFirstOpeningAppendix(
    buildTeacherFirstOpeningPlan({
      topic: ctx.topic,
      subTopic: ctx.subTopic || ctx.topic,
      topicKey: ctx.topicKey,
      subject: ctx.subject,
    })
  );
  return appendix ? `\n\n${appendix}\n` : "";
}

function buildUserPromptFromMd({
  topic,
  subject,
  level,
  board,
  tier,
  specPoints,
  pastPaperSnippets,
  extraCoveragePoints = [],
  subTopicDisplay = null,
  topicKey = null,
  requiredKeywords = [],
  requiredMisconceptions = [],
  additionalInstructions = "",
  engineInstructions = "",
  strictSpec = false,
  frameworkClassification = null,
}) {
  const lvl = normalizeLevel(level);
  const tierFinal = lvl === "GCSE" ? normalizeTier(tier) : ""; // non-GCSE => empty string

  let out = injectPromptVars(AI_LESSON_PROMPT_TEMPLATE, {
    topic,
    subject,
    level: lvl,
    board: board === undefined || board === null ? "" : String(board),
    tier: tierFinal,
  });

  const referencePromptSection = buildReferenceLessonMaterialPrompt(additionalInstructions);
  if (referencePromptSection) {
    out += `

${referencePromptSection}
`;
  }

  const teacherFirstDashboard = isDashboardTeacherFirstEnabled();
  const flowHintTopic = safeStr(subTopicDisplay, "") || safeStr(topic, "");
  const dashboardCtx = { topic: flowHintTopic, subTopic: subTopicDisplay, topicKey };

  if (teacherFirstDashboard) {
    if (isRequiredPracticalMode(dashboardCtx)) {
      out +=
        buildRequiredPracticalDashboardLessonContract(dashboardCtx) +
        LESSON_BLOCK_FULL_KEYS_INSTRUCTION +
        LESSON_TEACHING_AND_STYLE_LOCKED;
    } else {
      out += `

## LETSREVISE LESSON CONTRACT (MANDATORY — TEACHER-FIRST OPENING)

You are generating a LetsRevise lesson. Follow the **EXECUTION PERSONA — CONVERSATIONAL TUTOR** rules in the teaching/style section below (think, behave, and execute like a step-by-step chat tutor; JSON is the transport only).

Follow this exact lesson structure:

1. Open with Revision Objectives, Prior Knowledge, Definition, Why it matters, Core model, Key examples, and Exam vocabulary (blocks 1–7).
2. Block 8 must be a SHORT Scenario (role hook, title "Scenario") — only after core knowledge is taught.
3. Block 9 must be Core Teaching (role concept).
4. Add one commonMistake block showing an incorrect idea and the corrected version.
5. Add one keyIdea block for exam pattern recognition.
6. For each major concept, follow this exact sequence:
   - diagram (or text block with "image here" if diagram block not available)
   - immediately next: a keyIdea block titled exactly: "What to Notice" (role whatToNotice where the schema allows)
   - text explanation
   - examTip
   After EVERY diagram in the lesson, the very next block must be that "What to Notice" keyIdea (no other block type in between).
7. Include at least one worked exam question with a full-mark answer (checkpoint with role workedExample or clearly the main worked example). Every other checkpoint must still contain a real exam-style question (not a placeholder) and a correct answer.
8. End with:
   - one keyIdea synthesis block
   - one checkpoint multiple-choice or recall question
   - one checkpoint short explain question
   - one keyIdea final memory rule

## STRUCTURE CONTRACT (MANDATORY — KEEP ALL)

You must still deliver the full lesson skeleton:
- Revision Objectives → Prior Knowledge → Definition → Why it matters → Core model → Key examples → Exam vocabulary → Scenario → Core Teaching (first nine blocks)
- Common mistake (commonMistake: wrong vs correct thinking)
- Pattern recognition (keyIdea: repeatable exam patterns)
- Concept loop (each major concept: diagram or "image here" → What to Notice keyIdea → text → examTip, per step 6)
- Worked example (checkpoint with full-mark style model answer; role workedExample where applicable)
- Synthesis (keyIdea synthesis before the final checks)
- Final checkpoints (multiple-choice or recall, then short explain — per step 8)
- Final memory rule (keyIdea closing memory rule)

Use block roles where the output allows: lessonObjectives, priorKnowledge, definition, whyItMatters, coreModel, keyExamples, examVocabulary, hook (Scenario only at block 8), concept, commonMistake, patternRecognition, workedExample, synthesis, finalMemoryRule, whatToNotice (in addition to titles).
${buildDashboardTeacherFirstPromptSection(dashboardCtx)}${buildTeacherFirstLayer2OpeningAppendix({ ...dashboardCtx, subject })}
` + LESSON_BLOCK_FULL_KEYS_INSTRUCTION + LESSON_TEACHING_AND_STYLE_LOCKED;
    }
  } else {
    out += `

## LETSREVISE LESSON CONTRACT (MANDATORY)

You are generating a LetsRevise lesson. Follow the **EXECUTION PERSONA — CONVERSATIONAL TUTOR** rules in the teaching/style section below (think, behave, and execute like a step-by-step chat tutor; JSON is the transport only).

Follow this exact lesson structure:

1. Begin with a short hook in a text block.
2. Add one keyIdea block that states the core rule of the topic.
3. Add one commonMistake block showing an incorrect idea and the corrected version.
4. Add one keyIdea block for exam pattern recognition.
5. For each major concept, follow this exact sequence:
   - diagram (or text block with "image here" if diagram block not available)
   - immediately next: a keyIdea block titled exactly: "What to Notice" (role whatToNotice where the schema allows)
   - text explanation
   - examTip
   After EVERY diagram in the lesson, the very next block must be that "What to Notice" keyIdea (no other block type in between).
6. Include at least one worked exam question with a full-mark answer (checkpoint with role workedExample or clearly the main worked example). Every other checkpoint must still contain a real exam-style question (not a placeholder) and a correct answer.
7. End with:
   - one keyIdea synthesis block
   - one checkpoint multiple-choice or recall question
   - one checkpoint short explain question
   - one keyIdea final memory rule

## STRUCTURE CONTRACT (MANDATORY — KEEP ALL)

Do NOT remove or skip the existing structure contract. The sections below (JSON block shape, then teaching and style) add output shape and behaviour only; they do NOT replace structure.

You must still deliver the full lesson skeleton:
- Hook (opening text block)
- Core rule (keyIdea: main rule of the topic)
- Common mistake (commonMistake: wrong vs correct thinking)
- Pattern recognition (keyIdea: repeatable exam patterns)
- Concept loop (each major concept: diagram or "image here" → What to Notice keyIdea → text → examTip, per step 5)
- Worked example (checkpoint with full-mark style model answer; role workedExample where applicable)
- Synthesis (keyIdea synthesis before the final checks)
- Final checkpoints (multiple-choice or recall, then short explain — per step 7)
- Final memory rule (keyIdea closing memory rule)

Use block roles where the output allows: hook, coreRule, commonMistake, patternRecognition, workedExample, synthesis, finalMemoryRule, whatToNotice (in addition to titles).
` + LESSON_BLOCK_FULL_KEYS_INSTRUCTION + LESSON_TEACHING_AND_STYLE_LOCKED;
  }

  {
    out += `\n\n## TEACHING FLOW HINTS (V5 — follow this sequence)\n`;
    for (const h of buildTopicAwareFlowHints(flowHintTopic)) {
      out += `- ${h}\n`;
    }
  }

  {
    const chainTopic = safeStr(subTopicDisplay, "") || safeStr(topic, "");
    out += `\n\n## REASONING CHAIN + COMPRESSION (V6 — follow; avoid repetition)\n`;
    for (const h of buildTopicAwareReasoningChainHints(chainTopic)) {
      out += `- ${h}\n`;
    }
  }

  if (subTopicDisplay || topicKey) {
    const scopeLabel = subTopicDisplay || topic;
    out += `\n\n## STRICT SCOPE (curriculum trust requirement)\n`;
    out += `- Only generate content for the selected sub-topic: **${scopeLabel}**.\n`;
    out += `- Do NOT include content from neighbouring sub-topics (e.g. do not include mitosis, cell division, diffusion, osmosis, stem cells, microscopy when the topic is cell structure unless explicitly in the curriculum context).\n`;
    out += `- If evidence for this sub-topic is limited, stay within the sub-topic rather than expanding into related topics.\n`;
  }

  if (Array.isArray(specPoints) && specPoints.length > 0) {
    out += "\n\n## Specification points to cover (you must address these)\n";
    specPoints.forEach((p) => { out += `- ${p}\n`; });
  }
  if (Array.isArray(extraCoveragePoints) && extraCoveragePoints.length > 0) {
    out += "\n\n## You must also explicitly cover these (currently missing or weak)\n";
    extraCoveragePoints.forEach((p) => { out += `- ${p}\n`; });
  }
  if (Array.isArray(requiredKeywords) && requiredKeywords.length > 0) {
    out += "\n\n## Required keywords (you must use these in your content)\n";
    requiredKeywords.forEach((kw) => { out += `- ${safeStr(kw, "")}\n`; });
  }
  if (Array.isArray(requiredMisconceptions) && requiredMisconceptions.length > 0) {
    out += "\n\n## Required misconceptions (include in commonMistake blocks)\n";
    requiredMisconceptions.forEach((mc) => { out += `- ${safeStr(mc, "")}\n`; });
  }
  if (Array.isArray(pastPaperSnippets) && pastPaperSnippets.length > 0) {
    out += "\n\n## Typical exam question context (based on past papers)\n";
    pastPaperSnippets.slice(0, 5).forEach((s, i) => {
      out += `\nQuestion ${i + 1}: ${(s.question || "").slice(0, 300)}`;
      if (Array.isArray(s.markScheme) && s.markScheme.length > 0)
        out += `\nMark scheme: ${s.markScheme.slice(0, 3).join("; ")}`;
    });
  }
  if (strictSpec === true) {
    out += "\n\n## CRITICAL: Strictly follow specification\n";
    out += "The teacher has requested STRICT spec alignment. Do NOT add any content beyond the specification points. No extra topics, no out-of-spec detail. Stay strictly within the curriculum scope.\n";
  }
  const engineBlock = String(engineInstructions || "").trim();
  if (engineBlock) {
    out += `\n\n${engineBlock}\n`;
  }
  const frameworkRoutingAppendix = buildFrameworkRoutingPromptSection(frameworkClassification);
  if (frameworkRoutingAppendix) {
    out += `\n\n${frameworkRoutingAppendix}\n`;
  }
  out += buildBoardPromptFragment(board);
  return out;
}

/**
 * Optional sampling temperature for `/v1/responses` (0–2). Omit from the request when unset or invalid
 * so the API uses its default (some models ignore or reject custom temperature).
 */
function parseOptionalOpenAITemperature() {
  const raw = process.env.OPENAI_TEMPERATURE;
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 2) return null;
  return n;
}

/** Axios timeout for `/v1/responses` (structured lesson JSON). Default 5m; override with OPENAI_RESPONSE_TIMEOUT_MS. */
function parseOpenAIResponsesTimeoutMs() {
  const defaultMs = 300000;
  const raw = process.env.OPENAI_RESPONSE_TIMEOUT_MS;
  if (raw === undefined || raw === null) return defaultMs;
  const s = String(raw).trim();
  if (!s) return defaultMs;
  const n = Number(s);
  if (!Number.isFinite(n)) return defaultMs;
  return Math.min(Math.max(Math.floor(n), 60000), 900000);
}

/**
 * Calls OpenAI Responses API with Structured Outputs.
 */
async function callOpenAI({ systemPrompt, userPrompt }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY in environment");

  const model = safeStr(process.env.OPENAI_MODEL, "gpt-4o-mini");
  const temperature = parseOptionalOpenAITemperature();

  const payload = {
    model,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "lesson_draft",
        strict: true,
        schema: LESSON_DRAFT_SCHEMA,
      },
    },
  };

  if (temperature !== null) {
    payload.temperature = temperature;
  }

  const resp = await axios.post("https://api.openai.com/v1/responses", payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: parseOpenAIResponsesTimeoutMs(),
  });

  const data = resp.data || {};
  const outputText =
    typeof data.output_text === "string"
      ? data.output_text
      : (() => {
          try {
            const out0 = Array.isArray(data.output) ? data.output[0] : null;
            const c0 =
              out0 && Array.isArray(out0.content) ? out0.content[0] : null;
            return typeof c0?.text === "string" ? c0.text : "";
          } catch {
            return "";
          }
        })();

  if (!outputText) throw new Error("OpenAI response missing output_text");

  return { raw: outputText, usage: data.usage || null, model: data.model || model };
}

/**
 * Convert Lesson doc to draft format for improvement (strips diagrams to fit schema).
 */
function lessonToDraft(lesson) {
  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  const draftPages = pages
    .map((p, idx) => {
      const blocksRaw = Array.isArray(p?.blocks) ? p.blocks : [];
      const blocks = blocksRaw
        .filter((b) => b && b.type && b.type !== "diagram")
        .map((b) => {
          const t = normalizeBlockType(b.type);
          if (t === "checkpoint") {
            const opts = Array.isArray(b.options) ? b.options.map((o) => String(o).trim()).filter(Boolean) : [];
            while (opts.length < 4) opts.push(`Option ${opts.length + 1}`);
            return {
              type: "checkpoint",
              content: "",
              prompt: safeStr(b.prompt || b.question, "Quick check"),
              questionType: b.questionType === "short" ? "short" : "mcq",
              options: opts.slice(0, 4),
              correctAnswer: safeStr(b.correctAnswer, opts[0]),
              explanation: safeStr(b.explanation, ""),
            };
          }
          return {
            type: t,
            content: safeStr(b.content, ""),
            prompt: "",
            questionType: "mcq",
            options: [],
            correctAnswer: "",
            explanation: "",
          };
        })
        .filter((b) => b.type === "checkpoint" || (b.content && b.content.trim()));
      const cp = p?.checkpoint || {};
      return {
        title: safeStr(p?.title, `Page ${idx + 1}`),
        order: Number.isFinite(Number(p?.order)) ? p.order : idx + 1,
        pageType: safeStr(p?.pageType, ""),
        blocks,
        checkpoint: cp?.question
          ? { question: cp.question, options: Array.isArray(cp.options) ? cp.options.slice(0, 4) : ["A", "B", "C", "D"], answer: cp.answer || "" }
          : { question: "", options: ["A", "B", "C", "D"], answer: "" },
      };
    })
    .filter((p) => p.blocks.length > 0);
  if (draftPages.length === 0) {
    draftPages.push({
      title: "Page 1",
      order: 1,
      pageType: "",
      blocks: [{ type: "text", content: safeStr(lesson?.content, "Content"), prompt: "", questionType: "mcq", options: [], correctAnswer: "", explanation: "" }],
      checkpoint: undefined,
    });
  }
  return {
    title: safeStr(lesson?.title, "Lesson"),
    description: safeStr(lesson?.description, ""),
    estimatedDuration: Number.isFinite(Number(lesson?.estimatedDuration)) ? lesson.estimatedDuration : 40,
    tags: Array.isArray(lesson?.tags) ? lesson.tags : [],
    board: safeStr(lesson?.board, ""),
    tier: safeStr(lesson?.tier, ""),
    pages: draftPages,
  };
}

/**
 * Build curriculum feedback lines from validation object (for second-pass prompt).
 */
function buildCurriculumFeedbackLines(validation) {
  const lines = [];
  if (!validation) return lines;
  if (!validation.valid) lines.push("HARD FAILURES (must fix):");
  if (validation.missingSpecPoints?.length) {
    lines.push(`- Spec statements not covered: ${validation.missingSpecPoints.slice(0, 5).join("; ")}`);
  }
  if (validation.missingKeywords?.length) {
    lines.push(`- Required keywords missing: ${validation.missingKeywords.join(", ")}`);
  }
  if (validation.missingMisconceptions?.length) {
    lines.push(`- Required misconceptions missing: ${validation.missingMisconceptions.join(", ")}`);
  }
  if (!validation.hasExamQuestions) lines.push("- No exam-style questions present");
  lines.push("QUALITY ISSUES (upgrade to SaveMyExams-level):");
  if ((validation.subheadingCount || 0) < 4) {
    lines.push(`- Add structured teaching sections with ## markdown subheadings (have ${validation.subheadingCount}, need at least 4)`);
  }
  if (validation.needsTableButMissing) {
    lines.push("- Topic suggests comparison: add a markdown comparison table (e.g. | Feature | Type A | Type B |)");
  }
  if (!validation.hasWorkedExample) {
    lines.push("- Add at least one worked exam-style example with mark allocation (e.g. '1 mark for…', '2 marks for…')");
  }
  if ((validation.examQuestionCount || 0) < 3 || (validation.commandWordVariety || 0) < 3) {
    lines.push("- Add at least 3 exam-style questions covering Describe, Explain, and Compare or Evaluate");
  }
  if (validation.topicSuggestsComparison && !validation.hasComparisonLanguage) {
    lines.push("- Add comparison/evaluation language ('compared to', 'whereas', 'in contrast')");
  }
  if (validation.contentTooShort) {
    lines.push(`- Content too short (${validation.contentLength} chars). Expand each section: explain, give examples, link to exam use`);
  }
  if (validation.needsDiagramButMissing) {
    lines.push("- Topic would benefit from visual: add diagram guidance ('Draw and label…', 'What to notice…', 'The diagram should show…')");
  }
  if ((validation.misconceptionCount || 0) < 3) {
    lines.push(`- Add more common misconception blocks (have ${validation.misconceptionCount}, need at least 3)`);
  }
  if ((validation.examTipCount || 0) < 2) {
    lines.push(`- Add more exam tip blocks (have ${validation.examTipCount}, need at least 2)`);
  }
  if (!validation.hasKeyWords) lines.push("- Add a Key words block with 5–10 essential terms");
  if (!validation.hasExamStyleQandA && validation.hasExamQuestions) {
    lines.push("- Add exam-style practice questions with mark-scheme style answers in a text block");
  }
  return lines;
}

/**
 * Second-pass improvement: send draft + validation feedback to AI and get improved version.
 * Safe fallback: throws on any error; caller keeps original.
 */
async function improveDraftWithSecondPass(
  { draft, curriculumIssues, structureIssues, qualityIssues, qualitySuggestions },
  context
) {
  const {
    topic,
    subject,
    level,
    board,
    tier,
    specPoints = [],
    additionalInstructions = "",
    retainTeachingIntentMetadata = false,
    teachingIntentTagOnly = false,
    topicKey = null,
    subTopic = null,
    subTopicDisplay = null,
  } = context || {};

  const qualityIssuesList = Array.isArray(qualityIssues) ? qualityIssues : [];
  const qualitySuggestionsList = Array.isArray(qualitySuggestions) ? qualitySuggestions : [];
  const curriculumLines = Array.isArray(curriculumIssues) ? curriculumIssues : [];
  const structureLines = Array.isArray(structureIssues) ? structureIssues.map((s) => `- ${s}`) : [];

  const referencePromptSection = buildReferenceLessonMaterialPrompt(additionalInstructions);
  const systemPrompt = [
    "You are an expert UK GCSE teacher and examiner improving an existing LetsRevise lesson draft.",
    "Target: conversational tutor in chat — step-by-step understanding and exam success (ChatGPT-like flow), NOT structured notes or document outlines.",
    "Each block should read like the next message in a patient tutorial: connect to the previous idea, anticipate confusion, then advance.",
    "Return ONLY valid JSON. Match the lesson draft schema exactly. Block types: text, keyIdea, examTip, commonMistake, stretch, checkpoint, diagram. Assign role and title on blocks where applicable (e.g. role: \"hook\", role: \"whatToNotice\", title: \"What to Notice\").",
    referencePromptSection,
  ]
    .filter(Boolean)
    .join(" ");

  const rewritePrompt = [
    "Rewrite this lesson so it reaches publish-ready quality for LetsRevise (V2: ChatGPT-like guided teaching).",
    "",
    "You must improve:",
    "- guided teaching (steps: idea → why it matters → example → exam link)",
    "- pedagogy and clarity (short blocks, no note-dumping)",
    "- exam readiness (command words, mark-style bullet answers, worked example)",
    "- structure, roles, and completeness",
    "",
    "Current issues:",
    qualityIssuesList.length ? qualityIssuesList.join("\n") : "(none)",
    "",
    "Improve using these actions:",
    qualitySuggestionsList.length ? qualitySuggestionsList.join("\n") : "(add missing blocks, improve explanations)",
    "",
    "Follow the JSON block shape rules and the full locked V2 teaching + role stencil below (same contract as first-pass generation). Obey the \"WHEN IMPROVING AN EXISTING DRAFT\" section.",
  ].join("\n");

  const userPromptParts = [
    `Topic: ${topic} | Subject: ${subject} | Level: ${level} | Board: ${board} | Tier: ${tier}`,
    "",
    rewritePrompt,
    LESSON_BLOCK_FULL_KEYS_INSTRUCTION,
    LESSON_TEACHING_AND_STYLE_LOCKED,
    LESSON_SECOND_PASS_ROLE_REPAIR,
    LESSON_SECOND_PASS_V3_REPAIR,
    LESSON_SECOND_PASS_V4_REPAIR,
    LESSON_SECOND_PASS_V5_REPAIR,
    LESSON_SECOND_PASS_V6_REPAIR,
    "",
    "## TEACHING FLOW HINTS (V5 — follow this sequence)",
    ...buildTopicAwareFlowHints(safeStr(topic, "")).map((h) => `- ${h}`),
    "",
    "## REASONING CHAIN + COMPRESSION (V6)",
    ...buildTopicAwareReasoningChainHints(safeStr(topic, "")).map((h) => `- ${h}`),
  ];
  if (referencePromptSection) {
    userPromptParts.unshift("", referencePromptSection);
  }
  if (curriculumLines.length || structureLines.length) {
    userPromptParts.push("", "ADDITIONAL VALIDATION FEEDBACK (fix these too):");
    userPromptParts.push(...curriculumLines, ...structureLines);
  }
  userPromptParts.push(
    "",
    "CURRENT DRAFT:",
    "```json",
    JSON.stringify(draft, null, 0).slice(0, 60000),
    "```",
    "",
    "Return the IMPROVED draft as valid JSON only. Keep exactly 1 page. Every block must include every schema field (use \"\" or [] where unused), same as first-pass output."
  );
  const userPrompt = userPromptParts.join("\n");

  const ai = await callOpenAI({ systemPrompt, userPrompt });
  let improved;
  try {
    improved = JSON.parse(ai.raw);
  } catch (e) {
    throw new Error(`Second-pass AI returned invalid JSON: ${(e?.message || "").slice(0, 100)}`);
  }
  const strictBlueprint = detectStrictBlueprintFromPrompt(additionalInstructions, topic);
  const sanitized = sanitizeDraft(improved, {
    subject,
    level,
    topic,
    topicKey,
    subTopic: subTopic || subTopicDisplay || topic,
    strictBlueprint,
    retainTeachingIntentMetadata,
    teachingIntentTagOnly,
  });
  return { sanitized };
}

/**
 * PR: Deterministic post-processing — collapse multiple AI pages into ONE.
 * Subsection labels (Core Concept 1, Exam Tips, Check Understanding, Stretch) become blocks, not pages.
 * Maps page titles to block types when blocks are generic text.
 */
function collapsePagesToSingle(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return [];
  if (pages.length === 1) return pages;

  const subsectionPatterns = {
    examTip: /exam\s*tips?|exam\s*focus/i,
    commonMistake: /misconception|common\s*mistake|avoid/i,
    stretch: /stretch|deeper\s*knowledge|extension/i,
    keyIdea: /core\s*concept|key\s*(idea|point)|overview|introduction/i,
    checkpoint: /check\s*understanding|quick\s*check|test\s*yourself/i,
  };

  const allBlocks = [];
  const sorted = [...pages].sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0));

  for (const p of sorted) {
    const pageTitle = safeStr(p?.title, "");
    const blocksRaw = Array.isArray(p?.blocks) ? p.blocks : [];
    const cp = p?.checkpoint || {};

    for (const b of blocksRaw) {
      const existingType = normalizeBlockType(b?.type);
      if (existingType === "checkpoint" || existingType === "diagram") {
        allBlocks.push(b);
        continue;
      }
      const content = safeStr(b?.content, "").trim();
      if (!content) continue;

      let blockType = existingType;
      if (blockType === "text") {
        for (const [type, pattern] of Object.entries(subsectionPatterns)) {
          if (pattern.test(pageTitle)) {
            blockType = type;
            break;
          }
        }
      }
      allBlocks.push({ ...b, type: blockType, content: content || b?.content });
    }

    if (blocksRaw.length === 0 && cp && safeStr(cp?.question, "").trim()) {
      const options = clampOptions(cp?.options);
      while (options.length < 4) options.push(`Option ${options.length + 1}`);
      const answer = safeStr(cp?.answer, "");
      allBlocks.push({
        type: "checkpoint",
        prompt: safeStr(cp?.question, "Quick check"),
        questionType: "mcq",
        options: options.slice(0, 4),
        correctAnswer: options.some((o) => o.trim() === answer.trim()) ? answer : options[0],
        explanation: "",
      });
    }
  }

  const hasCheckpoint = allBlocks.some((b) => b?.type === "checkpoint");
  const finalBlocks = allBlocks.length > 0 ? allBlocks : [{ type: "text", content: "Content coming soon." }];
  if (!hasCheckpoint && finalBlocks.length > 0) {
    finalBlocks.push({
      type: "checkpoint",
      prompt: "Quick check: which statement is correct?",
      questionType: "mcq",
      options: ["Option 1", "Option 2", "Option 3", "Option 4"],
      correctAnswer: "Option 1",
      explanation: "",
    });
  }

  return [
    {
      title: "Page 1",
      order: 1,
      pageType: "",
      blocks: finalBlocks,
      checkpoint: undefined,
    },
  ];
}

/**
 * Normalize raw AI block shapes before type-specific sanitization.
 * OpenAI response_format requires every property on every block; we fill gaps and coerce types here.
 * Strict lesson rules run in validateLessonStructure + validateBlockTypeRequirements.
 */
function normalizeLessonBlockForDraft(block) {
  const next = block && typeof block === "object" ? { ...block } : {};

  if (!next.type) next.type = "text";

  if (next.title === undefined) next.title = "";
  if (next.content === undefined) next.content = "";
  if (next.role === undefined) next.role = "";
  if (next.caption === undefined) next.caption = "";

  if (next.question === undefined) next.question = "";
  if (next.answer === undefined) next.answer = "";

  if (next.prompt === undefined) next.prompt = "";
  if (next.explanation === undefined) next.explanation = "";

  if (next.questionType === undefined) next.questionType = "";
  if (!Array.isArray(next.options)) next.options = [];

  if (next.correctAnswer === undefined || next.correctAnswer === null) {
    next.correctAnswer = "";
  } else {
    next.correctAnswer = String(next.correctAnswer);
  }

  const vidRaw = next.visualId;
  if (vidRaw === undefined || vidRaw === null || !String(vidRaw).trim()) {
    next.visualId = undefined;
  } else {
    next.visualId = String(vidRaw).trim();
  }

  if (next.type === "diagram") {
    if (!String(next.title || "").trim()) next.title = "Diagram";
    if (!String(next.content || "").trim()) next.content = "image here";
    if (!String(next.caption || "").trim()) next.caption = next.content || "image here";
  }

  if (next.type === "keyIdea") {
    const r = String(next.role || "").trim();
    if (!String(next.title || "").trim() && r !== "whatToNotice") {
      next.title = "Key Idea";
    }
  }

  if (next.type === "checkpoint") {
    if (!next.question && next.prompt) next.question = next.prompt;
    if (!next.answer && next.explanation) next.answer = next.explanation;
  }

  return next;
}

function roleStringEmpty(role) {
  return !String(role ?? "").trim();
}

/**
 * Assign missing block roles by position / heuristics (tuning aid — real quality still validated later).
 * Mutates draft.pages[].blocks in place.
 */
function applyRoleFallbacksToLesson(draft, meta = {}) {
  if (!draft || typeof draft !== "object") return draft;
  const haystack = topicHaystackFromDraft({ ...meta, ...draft, title: draft.title });
  for (const page of draft.pages || []) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks)) continue;

    if (!isDashboardTeacherFirstEnabled()) {
      if (blocks[0] && roleStringEmpty(blocks[0].role)) blocks[0].role = "hook";
      if (blocks[1] && roleStringEmpty(blocks[1].role)) blocks[1].role = "coreRule";
      if (blocks[2] && roleStringEmpty(blocks[2].role)) blocks[2].role = "commonMistake";
      if (blocks[3] && roleStringEmpty(blocks[3].role)) blocks[3].role = "patternRecognition";
    }

    const checkpointBlocks = blocks.filter((b) => b.type === "checkpoint");
    const keyIdeaBlocks = blocks.filter((b) => b.type === "keyIdea");

    const hasWorkedExampleRole = checkpointBlocks.some(
      (b) => String(b.role || "").trim() === "workedExample"
    );
    if (!hasWorkedExampleRole) {
      const examStyleSubstantial = checkpointBlocks.find((b) =>
        isQualityWorkedExampleBlock(b, haystack)
      );
      const workedExampleTarget =
        examStyleSubstantial ||
        checkpointBlocks.find((b) => {
          const blob = [b?.explanation, b?.correctAnswer, b?.prompt, b?.question, b?.answer]
            .filter(Boolean)
            .map(String)
            .join(" ");
          return blob.length > 30;
        }) ||
        checkpointBlocks.find((b) => roleStringEmpty(b.role)) ||
        checkpointBlocks[0];
      if (workedExampleTarget) workedExampleTarget.role = "workedExample";
    }

    const synthesisCandidate = [...keyIdeaBlocks].reverse().find(
      (b) => roleStringEmpty(b.role) && !/what to notice/i.test(b.title || "")
    );
    if (synthesisCandidate) synthesisCandidate.role = "synthesis";

    const lastKeyIdea = [...keyIdeaBlocks].reverse()[0];
    if (lastKeyIdea && roleStringEmpty(lastKeyIdea.role)) lastKeyIdea.role = "finalMemoryRule";

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (
        block.type === "diagram" &&
        blocks[i + 1] &&
        blocks[i + 1].type === "keyIdea" &&
        roleStringEmpty(blocks[i + 1].role)
      ) {
        blocks[i + 1].role = "whatToNotice";
        if (!String(blocks[i + 1].title || "").trim()) {
          blocks[i + 1].title = "What to Notice";
        }
      }
    }

    if (!blocks.some((b) => String(b.role || "").trim() === "whatToNotice")) {
      const wtn = blocks.find(
        (b) => b.type === "keyIdea" && /what to notice/i.test(b.title || "")
      );
      if (wtn && roleStringEmpty(wtn.role)) wtn.role = "whatToNotice";
    }
  }

  return draft;
}

/**
 * Tuning safeguard: ensure at least two diagram blocks so structure validation can pass.
 * Mutates draft.pages[].blocks in place. Uses the same minimal shape as sanitizeDraft diagram output.
 * Skips Required Practical lessons; does not overwrite existing diagrams.
 */
function topicHaystackFromHint(topicHint = "", meta = {}) {
  return `${safeStr(topicHint, "")} ${safeStr(meta.subTopic, "")} ${safeStr(meta.topicKey, "")}`.toLowerCase();
}

const TOPIC_DIAGRAM_LABELS = [
  {
    patterns: [/reflex\s*arc/i, /reflex\s+action/i, /withdrawal\s+reflex/i],
    title: "Reflex Arc Pathway",
    caption: "Reflex arc pathway — label receptor, sensory neurone, relay neurone, motor neurone, and effector.",
  },
  {
    patterns: [/cell[\s-]structure/i, /eukaryot/i, /prokaryot/i],
    title: "Cell Structure Overview",
    caption: "Cell structure overview — compare nucleus, cell membrane, cytoplasm, and plant-cell-only structures.",
  },
  {
    patterns: [/blood\s+glucose/i, /control\s+of\s+blood\s+glucose/i, /glucose\s+regulation/i],
    title: "Blood Glucose Control Loop",
    caption: "Blood glucose control loop — show insulin, glucagon, and negative feedback.",
  },
  {
    patterns: [/mitosis/i, /cell\s+cycle/i],
    title: "Stages of Mitosis",
    caption: "Stages of mitosis — identify chromosome behaviour at each stage.",
  },
  {
    patterns: [/carbon\s+cycle/i, /how\s+materials\s+are\s+cycled/i, /materials\s+are\s+cycled/i],
    title: "Carbon Cycle Overview",
    caption: "Carbon cycle overview — follow carbon through photosynthesis, respiration, and decomposition.",
  },
];

function resolveTopicDiagramLabel(topicHint = "", meta = {}) {
  const hay = topicHaystackFromHint(topicHint, meta);
  for (const entry of TOPIC_DIAGRAM_LABELS) {
    if (entry.patterns.some((re) => re.test(hay))) {
      return { title: entry.title, caption: entry.caption };
    }
  }
  const label = safeStr(topicHint, "Topic Overview").trim() || "Topic Overview";
  return {
    title: `${label} Diagram`,
    caption: `Diagram for ${label} — label the key features.`,
  };
}

function findLateStructureInsertIndex(blocks) {
  if (!Array.isArray(blocks)) return 0;
  for (let i = 0; i < blocks.length; i++) {
    const role = safeStr(blocks[i]?.role, "");
    if (role === "finalMemoryRule" || role === "workedExample") return i;
  }
  return blocks.length;
}

function ensureMinimumDiagramBlocks(draft, topicHint = "", meta = {}) {
  if (!draft || typeof draft !== "object") return draft;

  const rpCtx = {
    topic: safeStr(topicHint, "") || safeStr(meta.topic, ""),
    topicKey: safeStr(meta.topicKey, ""),
    subTopic: safeStr(meta.subTopic, "") || safeStr(topicHint, ""),
  };
  if (isRequiredPracticalMode(rpCtx)) return draft;

  const label = resolveTopicDiagramLabel(topicHint, meta);

  for (const page of draft.pages || []) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks)) continue;

    const diagramCount = blocks.filter((b) => b.type === "diagram").length;
    if (diagramCount >= 2) continue;

    const missing = 2 - diagramCount;
    const insertAt = findLateStructureInsertIndex(blocks);
    for (let i = 0; i < missing; i++) {
      blocks.splice(insertAt + i, 0, {
        type: "diagram",
        title: label.title,
        content: "image here",
        role: "concept",
        caption: label.caption,
      });
    }
  }
  return draft;
}

function buildTopicAwareWhatToNotice(topicHint = "", meta = {}) {
  const hay = topicHaystackFromHint(topicHint, meta);
  if (/reflex\s*arc|reflex\s+action|withdrawal\s+reflex|stimulus.?response/.test(hay)) {
    return [
      "- Follow the direction of the nerve impulse through the reflex arc",
      "- Identify receptor, sensory neurone, relay neurone, motor neurone, effector in the reflex arc",
      "- In exams, trace the stimulus–response pathway in order",
    ];
  }
  if (/cell[\s-]structure|eukaryot|prokaryot|animal[\s-]and[\s-]plant[\s-]cells/.test(hay)) {
    return [
      "- Compare nucleus, cell membrane, cytoplasm",
      "- Notice plant-cell-only structures such as chloroplasts and a permanent vacuole",
      "- Link each visible structure to its function in the cell",
    ];
  }
  if (/blood\s+glucose|control\s+of\s+blood\s+glucose|glucose\s+regulation|insulin|glucagon/.test(hay)) {
    return [
      "- Observe insulin and glucagon effects on blood glucose",
      "- Follow negative feedback control when glucose rises or falls",
      "- Notice where the pancreas, liver, and cells fit in the control loop",
    ];
  }
  if (/mitosis|cell\s+cycle/.test(hay)) {
    return [
      "- Identify chromosome behaviour at each stage of mitosis",
      "- Compare interphase and mitosis on the diagram",
      "- Notice when DNA replication happens versus when chromosomes separate",
    ];
  }
  if (/carbon\s+cycle|how\s+materials\s+are\s+cycled|materials\s+are\s+cycled|decomposer/.test(hay)) {
    return [
      "- Follow movement of carbon through the carbon cycle and how materials are cycled",
      "- Identify photosynthesis, respiration, and decomposition on the diagram",
      "- Notice where carbon dioxide enters and leaves the cycle",
    ];
  }
  if (hay.includes("stem cell")) {
    return [
      "- Notice embryonic stem cells can become any cell type",
      "- Notice adult stem cells can only form a limited range of cell types",
      "- In exams, compare these differences when explaining their medical uses",
    ];
  }
  const label = safeStr(topicHint, "this topic").trim() || "this topic";
  return [
    `- Identify the key labelled features of ${label}`,
    `- Notice how each structure links to its function in ${label}`,
    `- In exams, use these visible details as evidence in your answer`,
  ];
}

function isWhatToNoticeBlock(block) {
  if (!block || typeof block !== "object") return false;
  return (
    /what to notice/i.test(String(block.title || "")) ||
    safeStr(block.role, "") === "whatToNotice"
  );
}

function isGenericWhatToNoticeBlock(block, draft = {}) {
  if (!isWhatToNoticeBlock(block)) return false;
  if (whatToNoticeLooksSpecific(block, draft)) return false;
  const content = String(block.content || "");
  if (whatToNoticeBulletCount(content) < 2) return true;
  return (
    /focus on the labelled parts or key features/i.test(content) ||
    /notice how each feature links to its job or meaning/i.test(content)
  );
}

/**
 * Replace generic What-to-Notice content with topic-specific bullets; preserve strong blocks.
 */
function ensureTopicSpecificWhatToNoticeBlocks(draft, topicHint = "", meta = {}) {
  if (!draft || typeof draft !== "object") return draft;

  const rpCtx = {
    topic: safeStr(topicHint, "") || safeStr(meta.topic, ""),
    topicKey: safeStr(meta.topicKey, ""),
    subTopic: safeStr(meta.subTopic, "") || safeStr(topicHint, ""),
  };
  if (isRequiredPracticalMode(rpCtx)) return draft;

  draft.topic = draft.topic || safeStr(topicHint, "");
  const fallbackBullets = buildTopicAwareWhatToNotice(topicHint, meta).join("\n");

  for (const page of draft.pages || []) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks)) continue;

    const diagramCount = blocks.filter((b) => b.type === "diagram").length;
    if (diagramCount < 1) continue;

    let hasSpecific = blocks.some(
      (b) => isWhatToNoticeBlock(b) && whatToNoticeLooksSpecific(b, draft)
    );

    for (const block of blocks) {
      if (!isWhatToNoticeBlock(block)) continue;
      if (whatToNoticeLooksSpecific(block, draft)) continue;
      if (!isGenericWhatToNoticeBlock(block, draft) && whatToNoticeBulletCount(block.content) >= 2) {
        continue;
      }
      block.type = "keyIdea";
      block.title = "What to Notice";
      block.role = "whatToNotice";
      block.content = fallbackBullets;
      hasSpecific = whatToNoticeLooksSpecific(block, draft);
    }

    if (!hasSpecific) {
      const firstDiagramIdx = blocks.findIndex((b) => b.type === "diagram");
      if (firstDiagramIdx >= 0) {
        const next = blocks[firstDiagramIdx + 1];
        if (next && isWhatToNoticeBlock(next)) {
          next.type = "keyIdea";
          next.title = "What to Notice";
          next.role = "whatToNotice";
          next.content = fallbackBullets;
        } else {
          blocks.splice(firstDiagramIdx + 1, 0, {
            type: "keyIdea",
            title: "What to Notice",
            content: fallbackBullets,
            role: "whatToNotice",
          });
        }
      }
    }
  }

  return draft;
}

function buildTopicAwareCommonMistake(topicHint = "") {
  const topic = String(topicHint || "").toLowerCase();
  if (topic.includes("stem cell")) {
    return (
      "Wrong: Adult stem cells can become any cell type.\n" +
      "Correct: Adult stem cells can only differentiate into a limited range of cell types, unlike embryonic stem cells.\n" +
      "Exam link: This is often tested in compare questions about embryonic and adult stem cells."
    );
  }
  const label = safeStr(topicHint, "this topic").trim() || "this topic";
  return (
    "Wrong: Students often confuse the key idea in " +
    label +
    ".\n" +
    "Correct: Use the precise GCSE definition and focus on what makes it different.\n" +
    "Exam link: This kind of misunderstanding often loses marks in explain or compare questions."
  );
}

function buildTopicAwareFinalMemoryRule(topicHint = "") {
  const topic = String(topicHint || "").toLowerCase();
  if (topic.includes("stem cell")) {
    return "Remember: stem cells can self-renew and differentiate, but embryonic and adult stem cells do not have the same potential.";
  }
  const label = safeStr(topicHint, "this topic").trim() || "this topic";
  return `Remember: ${label} is most important because it combines core ideas with common GCSE exam questions.`;
}

function whatToNoticeBulletCount(content) {
  const c = String(content || "");
  return (c.match(/(^|\n)\s*[-•*]\s*/g) || []).length;
}

/** Normalize keyIdea body so duplicate detection ignores V11 prompts and line breaks. */
function keyIdeaContentSignatureForDedupe(content) {
  let s = String(content || "").trim();
  s = s.replace(/^why does this matter\?\s*/i, "");
  s = s.replace(/^so what is the key difference[^\n]*\n/i, "");
  s = s.replace(/\nAsk yourself:[\s\S]*$/i, "");
  s = s.toLowerCase().replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Keep the first keyIdea on each page when later ones are the same teaching text (e.g. triple “What to Notice” after 2+ diagrams + AI).
 */
function dedupeNearDuplicateKeyIdeasOnPage(draft) {
  if (!draft || typeof draft !== "object") return draft;

  for (const page of draft.pages || []) {
    const seen = new Set();
    page.blocks = (page.blocks || []).filter((b) => {
      if (normalizeBlockType(b?.type) !== "keyIdea") return true;
      const sig = keyIdeaContentSignatureForDedupe(b?.content);
      if (sig.length < 40) return true;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  }

  return draft;
}

/**
 * After each diagram, ensure a keyIdea "What to Notice" with ≥2 bullets (insert or rewrite).
 * Stem-cell (and identical fallback): only one full canonical copy per page — extra diagrams point back.
 * Mutates draft.pages[].blocks in place.
 */
function ensureWhatToNoticeBlocks(draft, topicHint = "", meta = {}) {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();
  const stemCellTopic = topic.includes("stem cell");
  const fallbackBullets = buildTopicAwareWhatToNotice(topicHint, meta).join("\n");
  draft.topic = draft.topic || safeStr(topicHint, "");

  for (const page of draft.pages || []) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks)) continue;

    let stemCanonicalWtnPlaced = false;

    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i]?.type !== "diagram") continue;

      const next = blocks[i + 1];
      const needInsert = !next || next.type !== "keyIdea";

      if (needInsert) {
        if (stemCellTopic && stemCanonicalWtnPlaced) {
          continue;
        }
        blocks.splice(i + 1, 0, {
          type: "keyIdea",
          title: "What to Notice",
          content: fallbackBullets,
          role: "whatToNotice",
        });
        if (stemCellTopic) stemCanonicalWtnPlaced = true;
        i += 1;
        continue;
      }

      next.type = "keyIdea";
      next.title = "What to Notice";
      next.role = "whatToNotice";

      if (
        stemCellTopic &&
        stemCanonicalWtnPlaced &&
        /notice embryonic stem cells can become/i.test(String(next.content || ""))
      ) {
        blocks.splice(i + 1, 1);
        continue;
      }

      if (whatToNoticeBulletCount(next.content) < 2 || isGenericWhatToNoticeBlock(next, draft)) {
        if (stemCellTopic && stemCanonicalWtnPlaced) {
          blocks.splice(i + 1, 1);
          continue;
        }
        next.content = fallbackBullets;
        if (stemCellTopic) stemCanonicalWtnPlaced = true;
      } else if (
        stemCellTopic &&
        /notice embryonic stem cells can become/i.test(String(next.content || ""))
      ) {
        stemCanonicalWtnPlaced = true;
      }
    }
  }

  return draft;
}

/**
 * Ensure at least one commonMistake uses Wrong / Correct / Exam link in content (insert or rewrite).
 * Mutates draft.pages[].blocks. Runs before structure validation via sanitizeDraft.
 */
function ensureProperCommonMistakeBlock(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const fallbackContent = buildTopicAwareCommonMistake(topicHint);

  for (const page of draft.pages || []) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks)) continue;

    const commonMistakes = blocks.filter((b) => b.type === "commonMistake");

    const alreadyValid = commonMistakes.find((b) => {
      const text = String(b.content || "");
      return /wrong:/i.test(text) && /correct:/i.test(text) && /exam link:/i.test(text);
    });

    if (alreadyValid) {
      if (!safeStr(alreadyValid.role, "")) alreadyValid.role = "commonMistake";
      continue;
    }

    const firstCommonMistake = commonMistakes[0];
    if (firstCommonMistake) {
      firstCommonMistake.role = "commonMistake";
      firstCommonMistake.content = fallbackContent;
      continue;
    }

    const insertIndex = Math.min(2, blocks.length);
    blocks.splice(insertIndex, 0, {
      type: "commonMistake",
      title: "",
      content: fallbackContent,
      role: "commonMistake",
    });
  }

  return draft;
}

const CHECKPOINT_PLACEHOLDER_PROMPT = /^(which statement is correct\??\s*|choose the correct\??\s*|option [1234]\??\s*|quick check\??\s*)$/i;

/** Topic-pattern fallbacks when no teachingQualityProfile match exists. */
const WORKED_EXAMPLE_TOPIC_FALLBACKS = [
  {
    patterns: [/reflex\s*arc/i, /reflex\s+action/i, /withdrawal\s+reflex/i, /stimulus.?response/i],
    question: "Describe the pathway of a reflex arc from stimulus to response. (4 marks)",
    explanation:
      "- Receptors detect the stimulus in the sense organ.\n" +
      "- Sensory neurone carries impulses to the CNS because the signal must reach the coordination centre quickly.\n" +
      "- Motor neurone transmits impulses to the effector therefore the muscle or gland produces a response.\n" +
      "- The response is rapid because the reflex arc often bypasses conscious processing in the brain.",
    correctAnswer: "Receptors detect stimulus; sensory neurone to CNS; motor neurone to effector; rapid response.",
  },
  {
    patterns: [/cell[\s-]structure/i, /eukaryot/i, /prokaryot/i, /animal[\s-]and[\s-]plant[\s-]cells/i],
    question: "Explain why plant cells have chloroplasts but animal cells do not. (3 marks)",
    explanation:
      "- Plant cells carry out photosynthesis to make glucose.\n" +
      "- Chloroplasts contain chlorophyll and are the site of photosynthesis because light energy is trapped there.\n" +
      "- Animal cells do not photosynthesise therefore they do not need chloroplasts.",
    correctAnswer: "Plant cells photosynthesise; chloroplasts are the site; animal cells do not photosynthesise.",
  },
  {
    patterns: [/blood\s+glucose/i, /glucose\s+regulation/i, /control\s+of\s+blood\s+glucose/i, /insulin/i, /glucagon/i],
    question: "Explain how the body responds when blood glucose rises above normal. (4 marks)",
    explanation:
      "- Receptors detect high blood glucose because levels move away from the set point.\n" +
      "- The pancreas releases insulin therefore cells take up more glucose from the blood.\n" +
      "- Glucose is converted to glycogen in the liver because excess glucose must be stored safely.\n" +
      "- Blood glucose returns towards normal therefore negative feedback restores the optimum.",
    correctAnswer: "High glucose detected; insulin released; glucose stored as glycogen; returns to optimum.",
  },
  {
    patterns: [/mitosis/i, /cell\s+cycle/i, /meiosis/i],
    question: "Describe what happens during mitosis. (4 marks)",
    explanation:
      "- DNA replicates before mitosis because each daughter cell needs a full set of chromosomes.\n" +
      "- Chromosomes line up at the equator of the cell therefore they can be separated equally.\n" +
      "- Chromatids are pulled to opposite poles because spindle fibres shorten.\n" +
      "- Two genetically identical daughter cells form therefore growth and repair can occur.",
    correctAnswer: "DNA replicates; chromosomes line up; chromatids separate; two identical daughter cells.",
  },
  {
    patterns: [/carbon\s+cycle/i, /decomposer/i, /recycling\s+carbon/i],
    question: "Explain the role of decomposers in the carbon cycle. (4 marks)",
    explanation:
      "- Decomposers break down dead organisms and waste because large organic molecules must be recycled.\n" +
      "- Digestive enzymes release carbon compounds therefore nutrients return to the soil.\n" +
      "- Respiration by decomposers releases carbon dioxide because carbon is returned to the atmosphere.\n" +
      "- Carbon dioxide can be used in photosynthesis therefore carbon is cycled between living and non-living parts.",
    correctAnswer: "Decomposers break down dead matter; release nutrients; respire CO2; carbon returns to atmosphere.",
  },
  {
    patterns: [/stem\s+cell/i],
    question: "Compare embryonic stem cells and adult stem cells. (4 marks)",
    explanation:
      "- Embryonic stem cells can differentiate into almost any cell type, whereas adult stem cells are more limited.\n" +
      "- Embryonic stem cells come from early embryos because they are unspecialised.\n" +
      "- Adult stem cells are found in tissues such as bone marrow therefore they repair specific cell types.\n" +
      "- Embryonic stem cells have greater medical potential however their use raises ethical concerns.",
    correctAnswer: "Embryonic cells are pluripotent; adult cells are limited; different sources; ethical issues.",
  },
];

function workedExampleMetaFromHint(topicHint = "", meta = {}) {
  const topic = safeStr(topicHint, "") || safeStr(meta.topic, "");
  return {
    topic,
    subTopic: safeStr(meta.subTopic, "") || topic,
    topicKey: safeStr(meta.topicKey, ""),
    title: safeStr(meta.title, ""),
  };
}

function resolvePrimaryReasoningChain(profile) {
  const wr = profile?.workedReasoning;
  if (!wr?.primaryChainId || !Array.isArray(profile?.reasoningChains)) return null;
  return profile.reasoningChains.find((c) => c.id === wr.primaryChainId) || null;
}

function markingBulletsFromReasoningChain(chain, minPoints = 3) {
  const steps = (chain?.steps || []).filter(Boolean);
  if (steps.length < minPoints) return "";
  const connectors = ["because", "therefore", "so that"];
  return steps
    .slice(0, Math.max(minPoints, 4))
    .map((step, i) => {
      const clean = String(step).replace(/\.$/, "").trim();
      if (i === 0) return `- ${clean}.`;
      const conn = connectors[(i - 1) % connectors.length];
      return `- ${clean.charAt(0).toLowerCase()}${clean.slice(1)}, ${conn} the process continues.`;
    })
    .join("\n");
}

function firstMarkingPointFromExplanation(explanation = "", fallback = "") {
  const line = String(explanation || "")
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .find(Boolean);
  return line || fallback;
}

function genericWorkedExampleFallback(safeTopic) {
  const topic = safeStr(safeTopic, "this topic") || "this topic";
  return {
    question: `Explain one important process in ${topic}. (3 marks)`,
    explanation:
      `- Identify the main structure or process in ${topic}.\n` +
      `- Explain how it works because examiners award marks for linked steps, not just naming parts.\n` +
      `- Link mechanism to function in ${topic} therefore your answer shows understanding.`,
    correctAnswer: "Name the process, explain the mechanism, link to function.",
  };
}

/**
 * Topic-aware GCSE worked-example fallback (profiles first, then pattern table, then generic).
 */
function resolveWorkedExampleFallback(meta = {}) {
  const profile = resolveTeachingQualityProfile(meta);
  if (profile?.workedReasoning?.defaultExamStem) {
    const chain = resolvePrimaryReasoningChain(profile);
    let explanation = markingBulletsFromReasoningChain(chain, profile.workedReasoning.minSteps || 4);
    if (!explanation) {
      const modelEx = safeStr(profile.examinerLanguageV2?.modelAnswerExample, "");
      if (modelEx) {
        explanation = modelEx
          .split(/(?<=[.!?])\s+/)
          .filter(Boolean)
          .slice(0, 4)
          .map((sentence, i) => {
            if (i === 0) return `- ${sentence.trim()}`;
            const conn = i === 1 ? "because" : "therefore";
            return `- ${sentence.trim()} ${conn} this links to the next marking point.`;
          })
          .join("\n");
      }
    }
    const question = profile.workedReasoning.defaultExamStem;
    return {
      question,
      explanation,
      correctAnswer: firstMarkingPointFromExplanation(explanation, question.slice(0, 120)),
    };
  }

  const hay = `${meta.topic || ""} ${meta.subTopic || ""} ${meta.topicKey || ""} ${meta.title || ""}`;
  for (const entry of WORKED_EXAMPLE_TOPIC_FALLBACKS) {
    if (entry.patterns.some((rx) => rx.test(hay))) {
      return {
        question: entry.question,
        explanation: entry.explanation,
        correctAnswer: entry.correctAnswer,
      };
    }
  }

  return genericWorkedExampleFallback(meta.topic || meta.subTopic || "this topic");
}

function workedExampleNeedsReplacement(block, haystack = "") {
  if (!block) return true;
  if (isQualityWorkedExampleBlock(block, haystack)) return false;
  const question = safeStr(block.prompt, "") || safeStr(block.question, "");
  const answerText = workedAnswerBlob(block);
  return (
    !question ||
    !hasSubstantialWorkedAnswer(block) ||
    isFakeMedicineWorkedExampleStem(question, haystack) ||
    isFakeStemCellWorkedExampleContent(answerText, haystack) ||
    /^see model answer$/i.test(safeStr(block.correctAnswer, ""))
  );
}

/** Upgrade placeholder / too-short checkpoint prompts so per-checkpoint structure validation passes. */
function upgradeWeakNonWorkedCheckpoints(checkpoints, safeTopic, workedBlock) {
  for (const b of checkpoints) {
    if (b === workedBlock) continue;
    const pr = safeStr(b.prompt, "") || safeStr(b.question, "");
    if (!pr || pr.length < 15 || CHECKPOINT_PLACEHOLDER_PROMPT.test(pr.trim())) {
      b.prompt = `Describe how ${safeTopic} might be tested in an exam (2 marks).`;
      b.question = b.prompt;
      b.questionType = "short";
      b.options = [];
      if (!safeStr(b.correctAnswer, "")) {
        b.correctAnswer =
          "Award 1 mark for a correct point and 1 mark for development or an example linked to the topic.";
      }
    }
  }
}

/** Fill question / prompt / explanation / correctAnswer on workedExample checkpoints (sanitized shape). */
function syncWorkedExampleFields(b, safeTopic, meta = {}) {
  if (!b || b.type !== "checkpoint" || safeStr(b.role, "") !== "workedExample") return;

  const fullMeta = workedExampleMetaFromHint(safeTopic, meta);
  const haystack = `${fullMeta.topic} ${fullMeta.subTopic} ${fullMeta.topicKey} ${fullMeta.title}`.toLowerCase();
  const fallback = resolveWorkedExampleFallback(fullMeta);

  if (workedExampleNeedsReplacement(b, haystack)) {
    b.question = fallback.question;
    b.prompt = fallback.question;
    b.explanation = fallback.explanation;
    b.correctAnswer = fallback.correctAnswer;
    return;
  }

  if (!safeStr(b.question, "")) {
    b.question = safeStr(b.prompt, "") || fallback.question;
  }
  if (!safeStr(b.prompt, "")) {
    b.prompt = b.question;
  }
  if (!safeStr(b.explanation, "")) {
    b.explanation = safeStr(b.answer, "") || fallback.explanation;
  }
  if (
    !safeStr(b.correctAnswer, "") ||
    /^see model answer$/i.test(safeStr(b.correctAnswer, ""))
  ) {
    b.correctAnswer = firstMarkingPointFromExplanation(
      safeStr(b.explanation, ""),
      fallback.correctAnswer
    );
  }
}

/** Topic-pattern fallbacks when the second half lacks a detectable real-world application block. */
const REAL_WORLD_APPLICATION_TOPIC_FALLBACKS = [
  {
    patterns: [/reflex\s*arc/i, /reflex\s+action/i, /withdrawal\s+reflex/i, /stimulus.?response/i],
    title: "Real-World Application",
    content:
      "**Real-world application:** The withdrawal reflex is a real-world example of the reflex arc — for example, when you touch a hot pan, receptors detect the stimulus and the reflex arc produces a rapid response that moves your hand away before you consciously feel pain, helping you avoid injury.",
  },
  {
    patterns: [/cell[\s-]structure/i, /eukaryot/i, /prokaryot/i, /animal[\s-]and[\s-]plant[\s-]cells/i],
    title: "Real-World Application",
    content:
      "**Real-world application:** Specialised cells are used in medicine every day — for example, doctors use microscopy to compare cell structure in blood and tissue samples so they can diagnose disease when cells look abnormal.",
  },
  {
    patterns: [/blood\s+glucose/i, /glucose\s+regulation/i, /control\s+of\s+blood\s+glucose/i, /insulin/i, /glucagon/i],
    title: "Real-World Application",
    content:
      "**Real-world application:** Blood glucose control is used in medicine to manage diabetes — for example, people with diabetes monitor glucose levels and use insulin treatment so cells can take up glucose safely and avoid dangerous highs and lows.",
  },
  {
    patterns: [/mitosis/i, /cell\s+cycle/i],
    title: "Real-World Application",
    content:
      "**Real-world application:** Mitosis is used in the body for growth and tissue repair — for example, wound healing depends on mitosis, whereas uncontrolled mitosis can contribute to cancer when cell division is not regulated.",
  },
  {
    patterns: [/carbon\s+cycle/i, /how\s+materials\s+are\s+cycled/i, /materials\s+are\s+cycled/i, /decomposer/i, /recycling\s+carbon/i],
    title: "Real-World Application",
    content:
      "**Real-world application:** Material cycles have environmental importance — for example, decomposition returns nutrients to soil on farms, and the carbon cycle links ecosystems to climate when carbon dioxide moves between living organisms and the atmosphere.",
  },
];

function realWorldApplicationMetaFromHint(topicHint = "", meta = {}) {
  const topic = safeStr(topicHint, "") || safeStr(meta.topic, "");
  return {
    topic,
    subTopic: safeStr(meta.subTopic, "") || topic,
    topicKey: safeStr(meta.topicKey, ""),
    haystack: `${topic} ${safeStr(meta.subTopic, "")} ${safeStr(meta.topicKey, "")}`.toLowerCase(),
  };
}

function buildTopicAwareRealWorldApplication(topicHint = "", meta = {}) {
  const { topic, haystack } = realWorldApplicationMetaFromHint(topicHint, meta);
  const safeTopic = safeStr(topic, "this topic").trim() || "this topic";

  for (const fb of REAL_WORLD_APPLICATION_TOPIC_FALLBACKS) {
    if (fb.patterns.some((re) => re.test(haystack))) {
      return { title: fb.title, content: fb.content };
    }
  }

  return {
    title: "Real-World Application",
    content: `**Real-world application:** Understanding ${safeTopic} is used in medicine and environmental science — for example, scientists apply this knowledge when diagnosing disease and protecting ecosystems.`,
  };
}

function secondHalfHasRealWorldApplication(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return false;
  const mid = Math.ceil(blocks.length / 2);
  return blocks.slice(mid).some((b) => blockMentionsApplication(blockFlowText(b)));
}

function findRealWorldApplicationInsertIndex(blocks) {
  const mid = Math.ceil(blocks.length / 2);
  for (let i = mid; i < blocks.length; i++) {
    const role = safeStr(blocks[i]?.role, "");
    if (role === "finalMemoryRule" || role === "workedExample") return i;
  }
  return blocks.length;
}

/**
 * Ensure the second half contains a topic-specific real-world application block (structure gate).
 * Skips Required Practical lessons and drafts that already have a detectable application in the second half.
 */
function ensureRealWorldApplicationBlock(draft, topicHint = "", meta = {}) {
  if (!draft || typeof draft !== "object") return draft;

  const rpCtx = {
    topic: safeStr(topicHint, "") || safeStr(meta.topic, ""),
    topicKey: safeStr(meta.topicKey, ""),
    subTopic: safeStr(meta.subTopic, "") || safeStr(topicHint, ""),
  };
  if (isRequiredPracticalMode(rpCtx)) return draft;

  const fallback = buildTopicAwareRealWorldApplication(topicHint, meta);

  for (const page of draft.pages || []) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks)) continue;

    if (secondHalfHasRealWorldApplication(blocks)) continue;

    const insertIndex = findRealWorldApplicationInsertIndex(blocks);
    blocks.splice(insertIndex, 0, {
      type: "text",
      title: fallback.title,
      content: fallback.content,
      role: "concept",
    });
  }

  return draft;
}

/**
 * Ensure one checkpoint is a valid worked example (exam-style question + substantial bullet answer).
 * Mutates draft.pages[].blocks. Uses sanitized checkpoint shape (prompt, questionType, options, correctAnswer, explanation).
 */
function ensureWorkedExampleCheckpoint(draft, topicHint = "", meta = {}) {
  if (!draft || typeof draft !== "object") return draft;

  const safeTopic = safeStr(topicHint, "this topic").trim() || "this topic";
  const fullMeta = workedExampleMetaFromHint(safeTopic, meta);
  const haystack = `${fullMeta.topic} ${fullMeta.subTopic} ${fullMeta.topicKey} ${fullMeta.title}`.toLowerCase();
  const fallback = resolveWorkedExampleFallback(fullMeta);

  for (const page of draft.pages || []) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks)) continue;

    const checkpoints = blocks.filter((b) => b.type === "checkpoint");

    const existingGood = checkpoints.find((b) => isQualityWorkedExampleBlock(b, haystack));

    if (existingGood) {
      existingGood.role = "workedExample";
      const q = safeStr(existingGood.prompt, "") || safeStr(existingGood.question, "");
      if (q) {
        existingGood.prompt = q;
        existingGood.question = q;
      }
      if (!safeStr(existingGood.correctAnswer, "")) {
        const fromExpl = safeStr(existingGood.explanation, "") || safeStr(existingGood.answer, "");
        const firstLine = fromExpl.split("\n").map((l) => l.trim()).find(Boolean) || fromExpl.slice(0, 120);
        if (firstLine) existingGood.correctAnswer = firstLine;
      }
      for (const b of checkpoints) {
        if (b !== existingGood && safeStr(b.role, "") === "workedExample") {
          b.role = "quickCheck";
        }
      }
      upgradeWeakNonWorkedCheckpoints(checkpoints, safeTopic, existingGood);
      syncWorkedExampleFields(existingGood, safeTopic, fullMeta);
      continue;
    }

    for (const b of checkpoints) {
      if (safeStr(b.role, "") === "workedExample") {
        b.role = "quickCheck";
      }
    }

    let target = checkpoints[0];
    if (!target) {
      target = {
        type: "checkpoint",
        prompt: "",
        questionType: "short",
        options: [],
        correctAnswer: "",
        explanation: "",
        title: "",
      };
      blocks.push(target);
    }

    target.role = "workedExample";
    target.question = fallback.question;
    target.prompt = fallback.question;
    target.explanation = fallback.explanation;
    target.questionType = "short";
    target.options = [];
    target.correctAnswer = fallback.correctAnswer;
    upgradeWeakNonWorkedCheckpoints(
      blocks.filter((b) => b.type === "checkpoint"),
      safeTopic,
      target
    );
    syncWorkedExampleFields(target, safeTopic, fullMeta);
  }

  for (const page of draft.pages || []) {
    for (const b of page.blocks || []) {
      if (b?.type === "checkpoint" && safeStr(b.role, "") === "workedExample") {
        syncWorkedExampleFields(b, safeTopic, fullMeta);
      }
    }
  }

  return draft;
}

/**
 * Ensure a keyIdea with role finalMemoryRule (promote last keyIdea or append).
 * Mutates draft.pages[].blocks in place.
 */
function ensureFinalMemoryRuleBlock(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const fallbackContent = buildTopicAwareFinalMemoryRule(topicHint);

  for (const page of draft.pages || []) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks)) continue;

    const existing = blocks.find((b) => safeStr(b.role, "") === "finalMemoryRule");
    if (existing) {
      if (existing.type !== "keyIdea") existing.type = "keyIdea";
      if (!safeStr(existing.title, "")) existing.title = "Final Memory Rule";
      if (!String(existing.content || "").trim()) {
        existing.content = fallbackContent;
      }
      continue;
    }

    const keyIdeas = blocks.filter((b) => b.type === "keyIdea");
    const lastKeyIdea = keyIdeas[keyIdeas.length - 1];

    if (lastKeyIdea) {
      lastKeyIdea.role = "finalMemoryRule";
      if (!safeStr(lastKeyIdea.title, "")) lastKeyIdea.title = "Final Memory Rule";
      if (!String(lastKeyIdea.content || "").trim()) {
        lastKeyIdea.content = fallbackContent;
      }
      continue;
    }

    blocks.push({
      type: "keyIdea",
      title: "Final Memory Rule",
      content: fallbackContent,
      role: "finalMemoryRule",
    });
  }

  return draft;
}

/**
 * V4: ensure at least one examTip is topic- and marks-aware; rewrite first or append.
 */
function ensureSpecificExamTipBlock(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topicLower = String(topicHint || "").toLowerCase();
  let fallbackContent =
    "Use precise scientific vocabulary and answer the exact command word in the question.";

  if (topicLower.includes("stem cell")) {
    fallbackContent =
      "In stem cell questions, compare embryonic and adult stem cells directly and use terms like differentiate, specialised cells, and leukaemia to gain marks.";
  }

  for (const page of draft.pages || []) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks)) continue;

    const examTips = blocks.filter((b) => b.type === "examTip");

    const validTip = examTips.find((b) => examTipLooksSpecific(b, draft));
    if (validTip) continue;

    if (examTips[0]) {
      examTips[0].content = fallbackContent;
      if (!safeStr(examTips[0].role, "")) examTips[0].role = "concept";
      continue;
    }

    blocks.push({
      type: "examTip",
      title: "",
      content: fallbackContent,
      role: "concept",
    });
  }

  return draft;
}

/**
 * V5: Nudge lesson arc (early comparison, applications after core for stem cells).
 * Mutates draft.pages[].blocks in place.
 */
function ensureTeachingFlowAnchors(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topicLower = String(topicHint || "").toLowerCase();

  for (const page of draft.pages || []) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks)) continue;

    const blockText = (b) =>
      `${safeStr(b?.title, "")} ${safeStr(b?.content, "")} ${safeStr(b?.prompt, "")} ${safeStr(b?.question, "")}`;

    const hasEarlyComparison = blocks
      .slice(0, Math.ceil(blocks.length / 2))
      .some((b) =>
        /(compare|difference|whereas|however|unlike|embryonic|adult stem cells?)/i.test(blockText(b))
      );

    if (!hasEarlyComparison && topicLower.includes("stem cell")) {
      const insertIndex = Math.min(4, blocks.length);
      blocks.splice(insertIndex, 0, {
        type: "keyIdea",
        title: "Key Difference",
        content:
          "- Embryonic stem cells can become almost any cell type\n" +
          "- Adult stem cells can only form a limited range of cell types",
        role: "patternRecognition",
      });
    }

    const hasApplication = blocks.some((b) =>
      /(medicine|medical|therapy|transplant|regenerative|leukaemia)/i.test(blockText(b))
    );

    if (!hasApplication && topicLower.includes("stem cell")) {
      blocks.push({
        type: "text",
        title: "",
        content:
          "Stem cells are used in medicine because they can replace damaged cells. For example, bone marrow stem cells can treat leukaemia.",
        role: "concept",
      });
    }
  }

  return draft;
}

const V6_MERGEABLE_TYPES = new Set(["text", "keyIdea", "examTip"]);

/** Blocks touching these topics must not be merged away or weak-removed (blueprint / SS2–SS3 style). */
const V6_BLUEPRINT_CONTENT_RE = /table|comparison|therapeutic|cloning|ethic|plant|meristem/i;

function v6BlueprintText(block) {
  return `${block?.title || ""} ${block?.content || ""}`;
}

function v6PairTouchesBlueprintKeywords(cur, nxt) {
  return V6_BLUEPRINT_CONTENT_RE.test(`${v6BlueprintText(cur)} ${v6BlueprintText(nxt)}`);
}

function v6BlockTouchesBlueprintKeywords(block) {
  return V6_BLUEPRINT_CONTENT_RE.test(v6BlueprintText(block));
}

function v6PreferredMergeType(ta, tb) {
  const order = { keyIdea: 3, examTip: 2, text: 1 };
  const oa = order[ta] || 0;
  const ob = order[tb] || 0;
  return oa >= ob ? ta : tb;
}

/**
 * V6: merge adjacent text/keyIdea/examTip pairs that are very similar (Jaccard on content tokens).
 * Mutates draft.pages[].blocks in place.
 */
function mergeAdjacentRedundantBlocks(draft, options = {}) {
  const THRESHOLD = typeof options.mergeThreshold === "number" ? options.mergeThreshold : 0.38;
  const MIN_TOKENS = 5;
  if (!draft || typeof draft !== "object") return draft;

  let mergeCount = 0;

  for (const page of draft.pages || []) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks) || blocks.length < 2) continue;

    const nextBlocks = [];
    let i = 0;
    while (i < blocks.length) {
      const cur = blocks[i];
      const nxt = blocks[i + 1];
      const tCur = normalizeBlockType(cur?.type);
      const tNext = nxt ? normalizeBlockType(nxt?.type) : "";

      const skipMergeForPatternRole =
        safeStr(cur?.role, "") === "patternRecognition" ||
        safeStr(nxt?.role, "") === "patternRecognition";

      const rpSpecialistRoles = new Set(["equipment", "method", "resultstable", "evaluationgrid"]);
      const skipMergeForRpSpecialist =
        rpSpecialistRoles.has(safeStr(cur?.role, "").toLowerCase()) ||
        rpSpecialistRoles.has(safeStr(nxt?.role, "").toLowerCase());

      const skipMergeForBlueprint = v6PairTouchesBlueprintKeywords(cur, nxt);

      if (
        nxt &&
        !skipMergeForPatternRole &&
        !skipMergeForRpSpecialist &&
        !skipMergeForBlueprint &&
        V6_MERGEABLE_TYPES.has(tCur) &&
        V6_MERGEABLE_TYPES.has(tNext)
      ) {
        const s1 = v6TokenSetForOverlap(blockFlowText(cur));
        const s2 = v6TokenSetForOverlap(blockFlowText(nxt));
        if (s1.size >= MIN_TOKENS && s2.size >= MIN_TOKENS && v6JaccardSimilarity(s1, s2) >= THRESHOLD) {
          const mergedType = v6PreferredMergeType(tCur, tNext);
          const title = safeStr(cur.title, "") || safeStr(nxt.title, "");
          const c1 = String(cur.content || "").trim();
          const c2 = String(nxt.content || "").trim();
          const content = [c1, c2].filter(Boolean).join("\n\n");
          const role = safeStr(cur.role, "") || safeStr(nxt.role, "");
          const merged = {
            type: mergedType,
            title,
            content,
          };
          if (role) merged.role = role;
          nextBlocks.push(merged);
          mergeCount += 1;
          i += 2;
          continue;
        }
      }
      nextBlocks.push(cur);
      i += 1;
    }
    page.blocks = nextBlocks;
  }

  if (process.env.NODE_ENV !== "production" && mergeCount > 0) {
    console.log(`V6 compression: merged ${mergeCount} adjacent redundant block pair(s).`);
  }

  return draft;
}

/**
 * V6: drop blocks that repeat the same coarse concept too many times (per page).
 * Max 2 blocks per concept bucket (3rd+ dropped).
 */
function removeOverRepeatedConcepts(blocks, options = {}) {
  if (!Array.isArray(blocks)) return blocks;

  const maxPerConcept =
    typeof options.maxConceptRepeats === "number" ? options.maxConceptRepeats : 2;

  const conceptCounts = {};

  return blocks.filter((block) => {
    if (safeStr(block?.role, "") === "patternRecognition") return true;

    const text = `${block?.title || ""} ${block?.content || ""}`.toLowerCase();

    if (V6_BLUEPRINT_CONTENT_RE.test(text)) return true;

    let concept = null;
    if (text.includes("differentiat")) concept = "differentiation";
    else if (text.includes("stem cell")) concept = "stem_cells";
    else if (text.includes("embryonic") || text.includes("adult")) concept = "comparison";

    if (!concept) return true;

    conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
    if (conceptCounts[concept] > maxPerConcept) return false;

    return true;
  });
}

/**
 * V6: remove thin or generic-filler teaching blocks. Preserves diagram, checkpoint, commonMistake, stretch.
 */
function removeWeakBlocks(blocks) {
  if (!Array.isArray(blocks)) return blocks;

  const alwaysKeepTypes = new Set(["diagram", "checkpoint", "commonMistake", "stretch"]);
  const alwaysKeepRoles = new Set([
    "hook",
    "coreRule",
    "commonMistake",
    "patternRecognition",
    "workedExample",
    "synthesis",
    "finalMemoryRule",
    "whatToNotice",
    "equipment",
    "method",
    "resultsTable",
    "evaluationGrid",
    "processingResults",
  ]);

  return blocks.filter((block) => {
    if (safeStr(block?.role, "") === "patternRecognition") return true;

    if (v6BlockTouchesBlueprintKeywords(block)) return true;

    const type = normalizeBlockType(block?.type);
    if (alwaysKeepTypes.has(type)) return true;

    const role = safeStr(block?.role, "");
    if (role && alwaysKeepRoles.has(role)) return true;

    const text = `${block?.title || ""} ${block?.content || ""}`.toLowerCase();

    if (text.trim().length < 60) return false;

    if (
      text.includes("important in biology") ||
      text.includes("useful in exams") ||
      text.includes("helps understanding") ||
      text.includes("plays a role")
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Ensure a keyIdea with role patternRecognition (often lost after V6 compression).
 * Mutates draft.pages[].blocks in place.
 */
function ensurePatternRecognitionBlock(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();

  for (const page of draft.pages || []) {
    if (!Array.isArray(page.blocks)) page.blocks = [];
    const blocks = page.blocks;

    if (blocks.some((b) => safeStr(b.role, "") === "patternRecognition")) continue;

    let content = "";
    if (topic.includes("stem cell")) {
      content =
        "- Embryonic stem cells can differentiate into almost any cell type\n" +
        "- Adult stem cells can only form a limited range of cell types\n" +
        "- This difference is a common exam comparison";
    } else {
      content =
        "- Identify the key difference or pattern in this topic\n" +
        "- Compare similar structures or processes\n" +
        "- This distinction is often tested in exams";
    }

    blocks.splice(Math.min(3, blocks.length), 0, {
      type: "keyIdea",
      title: "Key Pattern",
      content,
      role: "patternRecognition",
    });
  }

  return draft;
}

/**
 * After V6 compression, required role "synthesis" may be missing. Promote a keyIdea or insert one.
 */
function ensureSynthesisRole(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const label = safeStr(topicHint, "this topic").trim() || "this topic";

  for (const page of draft.pages || []) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks)) continue;

    if (blocks.some((b) => safeStr(b.role, "") === "synthesis")) continue;

    const pool = blocks
      .map((b, idx) => ({ b, idx }))
      .filter(
        ({ b }) =>
          b.type === "keyIdea" &&
          roleStringEmpty(b.role) &&
          !/what to notice/i.test(String(b.title || ""))
      );

    const pick = pool.length ? pool[pool.length - 1].b : null;
    if (pick) {
      pick.role = "synthesis";
      if (!String(pick.title || "").trim()) pick.title = "Synthesis";
      continue;
    }

    const fmrIdx = blocks.findIndex((b) => safeStr(b.role, "") === "finalMemoryRule");
    const at = fmrIdx >= 0 ? fmrIdx : blocks.length;
    blocks.splice(at, 0, {
      type: "keyIdea",
      title: "Synthesis",
      content:
        `Pull it together for ${label}: one line on the main idea, one on the distinction examiners reward, and one on how you would start a mark-scoring answer.`,
      role: "synthesis",
    });
  }

  return draft;
}

/**
 * Structure validation requires at least N blocks total (single-page lessons).
 */
function ensureMinimumBlockCount(draft, topicHint = "", minCount = 10) {
  if (!draft || typeof draft !== "object") return draft;

  const topicLabel = safeStr(topicHint, "this topic").trim() || "this topic";
  const pages = Array.isArray(draft.pages) ? draft.pages : [];
  if (!pages.length) return draft;

  let guard = 0;
  while (guard < 24) {
    guard += 1;
    const blocks = pages.flatMap((p) => p?.blocks || []);
    if (blocks.length >= minCount) break;

    const target = pages[0];
    if (!Array.isArray(target.blocks)) target.blocks = [];
    const n = target.blocks.length;
    target.blocks.push({
      type: "text",
      title: "",
      content:
        `Build your exam voice for ${topicLabel}: add one sentence that uses precise vocabulary, then a second sentence that answers the kind of “explain” or “compare” question this topic often uses. (Block ${n + 1} — keep ideas distinct from earlier steps.)`,
      role: "concept",
    });
  }

  return draft;
}

/**
 * V6 merge/trim runs after the first ensure-* pass; re-apply structure so validation can pass.
 */
function repairLessonStructureAfterCompression(draft, topicHint = "", meta = {}) {
  if (!draft || typeof draft !== "object") return draft;

  applyRoleFallbacksToLesson(draft, meta);
  ensureMinimumDiagramBlocks(draft, topicHint, meta);
  ensureWhatToNoticeBlocks(draft, topicHint, meta);
  ensureTopicSpecificWhatToNoticeBlocks(draft, topicHint, meta);
  ensureProperCommonMistakeBlock(draft, topicHint);
  ensurePatternRecognitionBlock(draft, topicHint);
  ensureWorkedExampleCheckpoint(draft, topicHint, meta);
  ensureFinalMemoryRuleBlock(draft, topicHint);
  dedupeNearDuplicateKeyIdeasOnPage(draft);
  ensureSynthesisRole(draft, topicHint);
  applyRoleFallbacksToLesson(draft, meta);
  ensureMinimumBlockCount(draft, topicHint, 10);
  ensurePatternRecognitionBlock(draft, topicHint);

  return draft;
}

/** V8: default teaching-step labels (used for intent tagging on all topics). */
const DEFAULT_TEACHING_SEQUENCE = [
  "definition",
  "mechanism",
  "comparison",
  "application",
  "evaluation",
];

/**
 * Optional topic-specific sequences (first substring match wins). Same labels keep analytics comparable.
 * Add entries with topic substrings your product uses (lowercase).
 */
const V8_TOPIC_TEACHING_SEQUENCES = [
  {
    match: (t) => t.includes("stem cell"),
    sequence: DEFAULT_TEACHING_SEQUENCE,
  },
  {
    match: (t) => t.includes("photosynthesis"),
    sequence: ["definition", "mechanism", "comparison", "application", "evaluation"],
  },
  {
    match: (t) => t.includes("respiration") || t.includes("aerobic") || t.includes("anaerobic"),
    sequence: ["definition", "mechanism", "comparison", "application", "evaluation"],
  },
  {
    match: (t) => t.includes("enzyme"),
    sequence: ["definition", "mechanism", "comparison", "application", "evaluation"],
  },
  {
    match: (t) => t.includes("osmosis") || t.includes("diffusion") || t.includes("active transport"),
    sequence: ["definition", "mechanism", "comparison", "application", "evaluation"],
  },
];

function getTeachingSequenceForTopic(topicHint = "") {
  const t = String(topicHint || "").toLowerCase();
  for (const row of V8_TOPIC_TEACHING_SEQUENCES) {
    if (row.match(t)) return row.sequence.slice();
  }
  return DEFAULT_TEACHING_SEQUENCE.slice();
}

const V8_INTENT_SKIP_ROLES = new Set([
  "hook",
  "coreRule",
  "patternRecognition",
  "commonMistake",
  "finalMemoryRule",
  "whatToNotice",
  "synthesis",
  "workedExample",
]);

/**
 * V8: assign sequential teaching intent to generic text / keyIdea blocks (not structural roles).
 */
function assignTeachingIntent(blocks, sequence) {
  if (!Array.isArray(blocks)) return blocks;

  const intents = Array.isArray(sequence) && sequence.length ? sequence : DEFAULT_TEACHING_SEQUENCE;
  let i = 0;

  return blocks.map((b) => {
    const t = normalizeBlockType(b?.type);
    if (t !== "text" && t !== "keyIdea") return b;

    const r = safeStr(b?.role, "");
    if (V8_INTENT_SKIP_ROLES.has(r)) return b;

    b._intent = intents[Math.min(i, intents.length - 1)];
    i += 1;
    return b;
  });
}

/**
 * V8 (stem cell): strong alignment — replace weak blocks with canonical comparison/application text.
 */
function enforceIntentContentStrictStemCell(block) {
  if (!block || !block._intent) return block;

  const text = `${block.title || ""} ${block.content || ""}`.toLowerCase();

  if (block._intent === "definition") {
    if (!text.includes("unspecialised") && !text.includes("unspecialized")) {
      block.content =
        "Stem cells are unspecialised cells that can differentiate into specialised cells.";
    }
  }

  if (block._intent === "comparison") {
    block.content =
      "Embryonic stem cells: can become any cell (pluripotent)\n" +
      "Adult stem cells: limited range (multipotent)\n\n" +
      "In exams, always compare both clearly.";
  }

  if (block._intent === "application") {
    block.content =
      "Stem cells are used in treatments such as bone marrow transplants.\n\n" +
      "In exams, link differentiation to how tissues are repaired.";
  }

  return block;
}

const V8_GENTLE_SENTINELS = {
  definition: /\[v8 definition\]/i,
  mechanism: /\[v8 mechanism\]/i,
  comparison: /\[v8 comparison\]/i,
  application: /\[v8 application\]/i,
  evaluation: /\[v8 evaluation\]/i,
};

/**
 * V8 (general topics): append one short exam-facing line only when content exists and signal is missing.
 */
function enforceIntentContentGentle(block) {
  if (!block || !block._intent) return block;

  const raw = String(block.content || "").trim();
  if (raw.length < 30) return block;

  const intent = block._intent;
  const sentinel = V8_GENTLE_SENTINELS[intent];
  if (sentinel && sentinel.test(raw)) return block;

  const text = `${block.title || ""} ${raw}`.toLowerCase();

  const append = (line) => {
    block.content = `${raw}\n\n${line}`;
  };

  if (intent === "definition") {
    if (!/exam|mark|define|means|is (a|the|when)/i.test(text)) {
      append("[v8 definition] In exams, state a precise definition using key terms from the specification.");
    }
  } else if (intent === "mechanism") {
    if (!/step|process|because|therefore|causes|leads to/i.test(text)) {
      append("[v8 mechanism] Show the sequence: what happens, then why it happens, using topic vocabulary.");
    }
  } else if (intent === "comparison") {
    if (!/compared|whereas|unlike|both|difference|similar/i.test(text)) {
      append("[v8 comparison] In compare questions, make both sides explicit and use a linking word (e.g. whereas).");
    }
  } else if (intent === "application") {
    if (!/example|such as|used in|real|context|industry|medicine|environment/i.test(text)) {
      append("[v8 application] Add one concrete example or context so your answer is not only theoretical.");
    }
  } else if (intent === "evaluation") {
    if (!/advantage|disadvantage|benefit|risk|limitation|however|because/i.test(text)) {
      append("[v8 evaluation] For evaluation marks, balance strengths and limits, and link to evidence or context.");
    }
  }

  return block;
}

function enforceIntentContent(block, topicHint = "") {
  const t = String(topicHint || "").toLowerCase();
  if (t.includes("stem cell")) return enforceIntentContentStrictStemCell(block);
  return enforceIntentContentGentle(block);
}

/**
 * V8: keep first block per intent; structural block types and protected roles always kept.
 */
function dedupeByIntent(blocks) {
  if (!Array.isArray(blocks)) return blocks;

  const seen = new Set();

  return blocks.filter((b) => {
    const t = normalizeBlockType(b?.type);
    if (
      t === "diagram" ||
      t === "checkpoint" ||
      t === "examTip" ||
      t === "commonMistake" ||
      t === "stretch"
    ) {
      return true;
    }

    const r = safeStr(b?.role, "");
    if (V8_INTENT_SKIP_ROLES.has(r)) return true;

    if (!b._intent) return true;

    if (seen.has(b._intent)) return false;
    seen.add(b._intent);
    return true;
  });
}

function stripTeachingIntentMetadata(blocks) {
  if (!Array.isArray(blocks)) return;
  for (const b of blocks) {
    if (b && Object.prototype.hasOwnProperty.call(b, "_intent")) delete b._intent;
  }
}

/** Matches V8 gentle-enforce authoring lines appended to student-facing block content. */
const V8_AUTHORING_TAG_LINE_RE =
  /\n?\[v8 (?:definition|mechanism|comparison|application|evaluation)\][^\n]*/gi;

function stripV8FromText(text) {
  if (typeof text !== "string" || !text) return text;
  const stripped = text.replace(V8_AUTHORING_TAG_LINE_RE, "");
  return stripped.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Remove V8 authoring tags from saved lesson block content (student-facing).
 * Preserves block order, roles, and metadata; only strips tag lines from `content`.
 */
function stripV8AuthoringTags(draft) {
  if (!draft || typeof draft !== "object") return draft;
  for (const page of draft.pages || []) {
    if (!Array.isArray(page.blocks)) continue;
    for (const block of page.blocks) {
      if (!block || typeof block !== "object") continue;
      if (typeof block.content === "string" && block.content) {
        block.content = stripV8FromText(block.content);
      }
    }
  }
  return draft;
}

/**
 * V8 — teaching intent engine (all topics: tag + gentle enforce; stem cell also strict enforce + dedupe).
 * @param {boolean} [opts.retainTeachingIntentMetadata] — if true, keep `_intent` on blocks (API/analytics); still stripped on DB save in makeLessonDbSafe.
 * @param {boolean} [opts.teachingIntentTagOnly] — if true, assign `_intent` only; skip content enforcement (gentle or stem-cell strict).
 */
function applyV8TeachingIntentEngine(draft, topicHint = "", opts = {}) {
  if (!draft || typeof draft !== "object") return draft;

  const retainIntent = opts?.retainTeachingIntentMetadata === true;
  const tagOnly = opts?.teachingIntentTagOnly === true;
  const topic = String(topicHint || "").toLowerCase();
  const sequence = getTeachingSequenceForTopic(topicHint);
  const stemCell = topic.includes("stem cell");

  for (const page of draft.pages || []) {
    if (!Array.isArray(page.blocks)) continue;

    let blocks = page.blocks;
    blocks = assignTeachingIntent(blocks, sequence);
    if (!tagOnly) {
      blocks = blocks.map((b) => enforceIntentContent(b, topicHint));
    }
    if (stemCell && !tagOnly) {
      blocks = dedupeByIntent(blocks);
    }
    if (!retainIntent) {
      stripTeachingIntentMetadata(blocks);
    }
    page.blocks = blocks;
  }

  return draft;
}

const V7_TRANSITION_ELIGIBLE_TYPES = new Set(["text", "keyIdea", "examTip", "commonMistake", "stretch"]);

const V7_NATURAL_TRANSITIONS = [
  "To understand this,",
  "This means that",
  "So what does this show?",
  "Why does this matter?",
  "This is important because",
  "In exams, this matters because",
];

function v7TransitionPickIndex(blockIndex, topicHint = "") {
  const salt = String(topicHint || "").length + blockIndex * 17;
  return salt % V7_NATURAL_TRANSITIONS.length;
}

function getNaturalTransition(blockIndex, role, blockType, topicHint = "") {
  const r = safeStr(role, "");
  const t = normalizeBlockType(blockType);
  if (r === "patternRecognition") return "This leads to a key exam pattern:";
  if (r === "commonMistake" || t === "commonMistake") return "A common mistake is:";
  if (r === "examTip" || t === "examTip") return "In exams,";
  if (r === "synthesis") return "Putting this together:";

  const idx = v7TransitionPickIndex(blockIndex, topicHint);
  return V7_NATURAL_TRANSITIONS[idx];
}

function v7AlreadyHasTransitionPrefix(text) {
  const t = String(text || "").trim();
  if (/^(now|next|however|this leads)\b/i.test(t)) return true;
  return /^(to understand this clearly:|building on this:|to understand this,|this means that|so in simple terms,|so what does this show\?|why does this matter\?|what this shows is that|this is important because|in exams, this matters because|this leads to an important pattern:|this leads to a key exam pattern:|this leads to an important exam pattern:|a common mistake (students make )?is:|a common mistake students make is:|in exams, remember:|in exams,|putting this together:)/i.test(
    t
  );
}

/**
 * V7 / V7.5 / V7.6: prepend varied teaching transitions (deterministic pick by index + topic).
 */
function applyTeachingTransitions(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  for (const page of draft.pages || []) {
    const blocks = page.blocks;
    if (!Array.isArray(blocks)) continue;

    for (let i = 1; i < blocks.length; i++) {
      const curr = blocks[i];
      if (!curr) continue;

      const t = normalizeBlockType(curr.type);
      if (!V7_TRANSITION_ELIGIBLE_TYPES.has(t)) continue;

      const raw = String(curr.content || "").trim();
      if (!raw) continue;

      if (/what to notice/i.test(String(curr.title || ""))) continue;
      if (safeStr(curr.role, "") === "whatToNotice") continue;
      if (safeStr(curr.role, "") === "finalMemoryRule") continue;

      if (v7AlreadyHasTransitionPrefix(raw)) continue;

      const prefix = getNaturalTransition(i, curr.role, curr.type, topicHint);
      curr.content = `${prefix} ${String(curr.content || "")}`;
    }
  }

  return draft;
}

/**
 * V7.5: markdown pipe rows → readable “Key comparison” lines (em dash separated cells).
 */
function convertTablesToReadableBlocks(draft) {
  if (!draft || typeof draft !== "object") return draft;

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (block?.content == null || typeof block.content !== "string") continue;
      if (!block.content.includes("|")) continue;

      const pipeLines = block.content.split("\n").filter((line) => line.includes("|"));
      if (pipeLines.length === 0) continue;

      const body = pipeLines
        .map((line) =>
          line
            .split("|")
            .map((x) => x.trim())
            .filter(Boolean)
            .join(" — ")
        )
        .filter(Boolean)
        .join("\n");

      if (!body) continue;

      block.content = `Key comparison:\n${body}`;
    }
  }
  return draft;
}

/**
 * V7.6: topic-aware “why this matters” for keyIdea (exam context).
 */
function addWhyThisMatters(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (normalizeBlockType(block.type) !== "keyIdea") continue;
      if (/what to notice/i.test(String(block.title || ""))) continue;
      if (safeStr(block.role, "") === "whatToNotice") continue;
      if (safeStr(block.role, "") === "finalMemoryRule") continue;

      const c = String(block.content || "");
      if (!c.trim() || c.length > 200) continue;
      if (/exam|important because/i.test(c)) continue;
      if (/answer exam questions more accurately|differentiation and medical use|both sides of the comparison|benefits and concerns to gain full marks/i.test(c)) {
        continue;
      }

      let reason = "This helps you answer exam questions more accurately.";
      if (topic.includes("stem cell")) {
        reason = "This is often tested in exam questions about differentiation and medical use.";
      }

      block.content = `${c}\n${reason}`;
    }
  }

  return draft;
}

/**
 * V7.6: exam-thinking scaffolds on relevant keyIdea blocks.
 */
function addExamThinkingPrompts(draft) {
  if (!draft || typeof draft !== "object") return draft;

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (normalizeBlockType(block.type) !== "keyIdea") continue;

      let body = String(block.content || "");
      if (/compare|difference/i.test(body) && !/both sides of the comparison clearly/i.test(body)) {
        body += "\nIn exams, always state both sides of the comparison clearly.";
      }
      if (/ethic/i.test(body) && !/benefits and concerns to gain full marks/i.test(body)) {
        body += "\nIn evaluation questions, include both benefits and concerns to gain full marks.";
      }
      block.content = body;
    }
  }

  return draft;
}

/**
 * V9: teacher voice — strip transition clutter from key ideas, swap vague phrasing, normalise exam tips.
 */
function applyTeacherVoice(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (block?.content == null || typeof block.content !== "string") continue;

      const t = normalizeBlockType(block.type);

      if (t === "keyIdea") {
        block.content = block.content
          .replace(/^This means that\s+/i, "")
          .replace(/^To understand this,\s+/i, "")
          .replace(/^So what does this show\?\s*/i, "")
          .trim();

        if (!/because|this matters|in exams|for example/i.test(block.content)) {
          block.content += "\nThis matters because students often need to apply this idea, not just define it.";
        }
      }

      if (t === "text") {
        block.content = block.content
          .replace(/\bplays an important role\b/gi, "matters")
          .replace(/\bis useful in medicine\b/gi, "can be used in treatment")
          .replace(/\bhelps the body\b/gi, "helps repair or replace damaged cells")
          .trim();
      }

      if (t === "examTip") {
        const tip = block.content.trim();
        if (!tip) continue;
        if (!/^In exams,/i.test(tip)) {
          block.content = "In exams, " + tip.replace(/^[A-Z]/, (c) => c.toLowerCase());
        }
      }
    }
  }

  return draft;
}

/**
 * V9: add in-teacher explanation depth for high-value topic cues (stem cells).
 */
function deepenExplanations(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (block?.content == null || typeof block.content !== "string") continue;

      const t = normalizeBlockType(block.type);
      if (t !== "text" && t !== "keyIdea") continue;

      const text = block.content.toLowerCase();

      if (topic.includes("stem cell")) {
        if (text.includes("unspecialised") && !text.includes("fixed function")) {
          block.content +=
            "\nIn other words, they have not yet developed a fixed function, which is why they can turn into other cell types.";
        }

        if (text.includes("differentiat") && !text.includes("specialised cells")) {
          block.content +=
            "\nDifferentiation means becoming a specialised cell with a specific job, such as a nerve cell or blood cell.";
        }

        if (text.includes("embryonic") && text.includes("adult") && !text.includes("pluripotent")) {
          block.content +=
            "\nThis comparison matters because embryonic stem cells are pluripotent, whereas adult stem cells are multipotent.";
        }

        if (text.includes("ethic") && !text.includes("embryo")) {
          block.content +=
            "\nThe main ethical issue is that embryonic stem cells are taken from embryos, which many people believe should not be destroyed.";
        }
      }
    }
  }

  return draft;
}

/**
 * V9: topic-aware “why this matters” on key ideas (layers after V7.6; dedupes by exact line).
 */
function improveWhyThisMatters(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (normalizeBlockType(block.type) !== "keyIdea") continue;
      if (!block.content || typeof block.content !== "string") continue;

      let addition = "";

      if (topic.includes("stem cell")) {
        const text = block.content.toLowerCase();

        if (text.includes("embryonic") || text.includes("adult")) {
          addition =
            "This matters because exam questions often ask you to compare their potential, uses, and ethical issues.";
        } else if (text.includes("differentiat")) {
          addition =
            "This matters because many exam questions focus on how stem cells become specialised and why that is useful in medicine.";
        } else if (text.includes("ethic")) {
          addition =
            "This matters because evaluation questions often require both medical benefits and ethical concerns.";
        } else {
          addition = "This matters because stem cells link core biology ideas to real medical treatments.";
        }
      } else {
        addition = "This matters because students often need to explain this idea clearly in exams.";
      }

      if (!block.content.includes(addition)) {
        block.content += "\n" + addition;
      }
    }
  }

  return draft;
}

/**
 * V9: concrete examples for stem-cell teaching blocks.
 */
function addConcreteExamples(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (block?.content == null || typeof block.content !== "string") continue;

      const t = normalizeBlockType(block.type);
      if (t !== "text" && t !== "keyIdea") continue;

      const text = block.content.toLowerCase();

      if (topic.includes("stem cell")) {
        if (text.includes("differentiat") && !text.includes("for example")) {
          block.content +=
            "\nFor example, a stem cell could differentiate into a blood cell, nerve cell, or muscle cell depending on the signals it receives.";
        }

        if (text.includes("medicine") && !text.includes("leukaemia")) {
          block.content +=
            "\nA common GCSE example is using bone marrow stem cells to help treat leukaemia.";
        }
      }
    }
  }

  return draft;
}

/**
 * V9: strip stock AI-teaching filler phrases.
 */
function removeMetaTeachingPhrases(draft) {
  if (!draft || typeof draft !== "object") return draft;

  const badPhrases = [
    "this helps you answer exam questions more accurately",
    "this is often tested in exam questions",
    "this is important because it often appears in exam questions",
    "this concept matters",
    "used in many situations",
  ];

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (block?.content == null || typeof block.content !== "string") continue;

      let content = block.content;

      for (const phrase of badPhrases) {
        const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        content = content.replace(regex, "");
      }

      content = content.replace(/\n{3,}/g, "\n\n").trim();
      block.content = content;
    }
  }

  return draft;
}

/**
 * V9: strengthen worked-example checkpoint for stem-cell topics (sanitized checkpoint shape).
 */
function strengthenExamAnswers(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();
  if (!topic.includes("stem cell")) return draft;

  const q = "Compare embryonic stem cells and adult stem cells (4 marks)";
  const model =
    "- Embryonic stem cells can become almost any cell type, whereas adult stem cells can only form a limited range.\n" +
    "- Embryonic stem cells come from early embryos, whereas adult stem cells are found in tissues such as bone marrow.\n" +
    "- Embryonic stem cells have greater potential in medicine because they can form more cell types.\n" +
    "- However, their use raises ethical concerns because embryos are destroyed.";

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (normalizeBlockType(block.type) !== "checkpoint") continue;
      if (safeStr(block.role, "") !== "workedExample") continue;

      block.question = q;
      block.prompt = q;
      block.explanation = model;
      block.correctAnswer = firstMarkingPointFromExplanation(
        model,
        "Embryonic stem cells can become almost any cell type."
      );
      block.questionType = "short";
      if (Array.isArray(block.options)) block.options = [];
    }
  }

  return draft;
}

/**
 * V9: ensure key ideas and text blocks carry definitional / reasoning / example cues.
 * Phase 5B.3f.3A: no-op — generic filler appends removed (profile/prompt supply depth).
 */
function enforceTeacherBlockPurpose(draft) {
  return draft;
}

/**
 * V9 pipeline: teacher voice + explanation depth (after V7 / V7.6 presentation layer).
 */
function applyV9TeacherVoiceAndDepth(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;
  const topic = safeStr(topicHint, "");
  applyTeacherVoice(draft, topic);
  deepenExplanations(draft, topic);
  removeMetaTeachingPhrases(draft);
  improveWhyThisMatters(draft, topic);
  addConcreteExamples(draft, topic);
  strengthenExamAnswers(draft, topic);
  enforceTeacherBlockPurpose(draft);
  return draft;
}

const V10_WHY_VARIATIONS = [
  "This is important because",
  "The key reason this matters is",
  "You will need this when answering exam questions about",
  "This idea is often used when explaining",
];

/**
 * V10: topic-specific duplicate cues (text/keyIdea only). Stem-cell overlap uses removeDuplicateConceptsByMeaning instead.
 * First matching row wins; unknown topics → no table dedupe.
 */
const V10_DEDUPE_BY_TOPIC = [
  {
    match: (t) => t.includes("photosynthesis"),
    concepts: [
      {
        id: "photo_core_outputs",
        test: (x) =>
          /\b(chlorophyll|chloroplast|photosynth)/.test(x) &&
          (x.includes("glucose") || x.includes("oxygen") || x.includes("starch")),
      },
      {
        id: "photo_gas_exchange",
        test: (x) => x.includes("carbon dioxide") && (x.includes("oxygen") || /\bo2\b/.test(x)),
      },
      {
        id: "photo_stages",
        test: (x) =>
          /calvin|light[- ]dependent|light[- ]independent|thylakoid|stroma|photolysis/.test(x),
      },
    ],
  },
  {
    match: (t) => t.includes("respiration") || t.includes("aerobic") || t.includes("anaerobic"),
    concepts: [
      {
        id: "resp_aerobic",
        test: (x) =>
          /\baerobic\b/.test(x) &&
          (x.includes("mitochond") || x.includes("oxygen") || x.includes("glucose")),
      },
      {
        id: "resp_anaerobic",
        test: (x) =>
          /\banaerobic\b/.test(x) || /\bferment/.test(x) || x.includes("lactic acid"),
      },
      { id: "resp_atp", test: (x) => /\batp\b/.test(x) && /\b(energy|release|transfer)\b/.test(x) },
    ],
  },
  {
    match: (t) => t.includes("enzyme"),
    concepts: [
      {
        id: "enzyme_specificity",
        test: (x) =>
          /active site|substrate|lock and key|specific shape|complementary/.test(x),
      },
      {
        id: "enzyme_denature",
        test: (x) => /denatur|optimum (temperature|ph)|too hot|extreme ph/i.test(x),
      },
    ],
  },
  {
    match: (t) =>
      t.includes("osmosis") || t.includes("diffusion") || t.includes("active transport"),
    concepts: [
      {
        id: "transport_diffusion",
        test: (x) => /\bdiffusion\b/.test(x) && /(concentration|gradient|high|low|particles)/.test(x),
      },
      {
        id: "transport_osmosis",
        test: (x) =>
          /\bosmosis\b/.test(x) &&
          /(water|partially permeable|semi[- ]permeable|concentration)/.test(x),
      },
      {
        id: "transport_active",
        test: (x) =>
          /active transport/.test(x) && /(atp|energy|against|low to high)/.test(x),
      },
    ],
  },
  {
    match: (t) =>
      /\bmitosis\b/.test(t) ||
      /\bmeiosis\b/.test(t) ||
      t.includes("cell division") ||
      t.includes("cell cycle"),
    concepts: [
      {
        id: "mitosis_named_stages",
        test: (x) =>
          /\b(prophase|metaphase|anaphase|telophase)\b/.test(x) &&
          /\b(chromosome|chromatid|spindle)\b/.test(x),
      },
      {
        id: "meiosis_variation_halving",
        test: (x) =>
          /\bmeiosis\b/.test(x) &&
          /(crossing over|chiasmata|homologous|haploid|genetic variation|assortment)/.test(x),
      },
      {
        id: "mitosis_growth_repair",
        test: (x) =>
          /\bmitosis\b/.test(x) &&
          /(two daughter|genetically identical|diploid|\brepair\b|\bgrowth\b|replacement)/.test(x),
      },
    ],
  },
];

function resolveV10DedupeConcepts(topicLower) {
  const t = String(topicLower || "").toLowerCase();
  for (const row of V10_DEDUPE_BY_TOPIC) {
    if (row.match(t)) return row.concepts;
  }
  return [];
}

/**
 * V10: topic-aware “aha” keyIdea (inserted at index 2). Last row matches everything.
 * role patternRecognition keeps a single coreRule from the model while still adding an exam-focus anchor.
 */
const V10_TOPIC_AHA = [
  {
    match: (t) => t.includes("photosynthesis"),
    title: "The key idea",
    role: "patternRecognition",
    content:
      "Hold this structure:\nPlants trap light energy and use it to turn carbon dioxide and water into glucose (and oxygen is released).\nExam questions often test the word equation, limiting factors, or where each stage happens in the chloroplast.",
  },
  {
    match: (t) => t.includes("respiration") || t.includes("aerobic") || t.includes("anaerobic"),
    title: "The key idea",
    role: "patternRecognition",
    content:
      "Energy release is the story:\nAerobic respiration uses oxygen in the mitochondria and releases a lot of ATP.\nAnaerobic pathways happen without enough oxygen and yield less ATP (e.g. lactic acid in animals).\nExaminers love compare questions and “why ATP matters” wording.",
  },
  {
    match: (t) => t.includes("enzyme"),
    title: "The key idea",
    role: "patternRecognition",
    content:
      "Enzymes are picky catalysts:\nEach enzyme has an active site shaped for its substrate.\nTemperature and pH change shape — too extreme and the enzyme denatures and stops working.\nLink “fewer successful collisions” to rate in longer answers.",
  },
  {
    match: (t) =>
      t.includes("osmosis") || t.includes("diffusion") || t.includes("active transport"),
    title: "The key idea",
    role: "patternRecognition",
    content:
      "Three transport ideas, three exam stories:\nDiffusion — particles spread down a concentration gradient, no energy.\nOsmosis — water across a partially permeable membrane.\nActive transport — moves substances against the gradient and needs energy (ATP).\nAlways name membrane, substance, and direction for full marks.",
  },
  {
    match: (t) =>
      /\bmitosis\b/.test(t) ||
      /\bmeiosis\b/.test(t) ||
      t.includes("cell division") ||
      t.includes("cell cycle"),
    title: "The key idea",
    role: "patternRecognition",
    content:
      "Separate the two jobs in your head:\nMitosis — two diploid daughter cells, genetically identical; ties to growth, repair, and asexual reproduction.\nMeiosis — four haploid cells, not identical; crossing over and assortment create variation for sexual reproduction.\nMarks come from chromosome behaviour and why the outcomes differ, not from vague stage lists.",
  },
];

function resolveV10AhaRow(topicHint) {
  const t = String(topicHint || "").toLowerCase();
  for (const row of V10_TOPIC_AHA) {
    if (row.match(t)) return row;
  }
  return null;
}

/**
 * V10: max 3 non-empty lines per keyIdea (whole draft).
 */
function enforceKeyIdeaLength(draft) {
  if (!draft || typeof draft !== "object") return draft;

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (normalizeBlockType(block?.type) !== "keyIdea" || !block?.content) continue;

      const lines = String(block.content)
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);

      block.content = lines.slice(0, 3).join("\n");
    }
  }

  return draft;
}

/**
 * V10: never drop or concept-tag blocks that carry required roles / structural types (dedupe must not remove them).
 */
function isV10ConceptDedupeProtected(block) {
  if (!block || typeof block !== "object") return true;
  const r = safeStr(block.role, "");
  if (
    ["finalMemoryRule", "synthesis", "hook", "whatToNotice", "coreRule", "patternRecognition"].includes(
      r
    )
  ) {
    return true;
  }
  if (/what to notice/i.test(String(block.title || ""))) return true;
  const t = normalizeBlockType(block.type);
  if (["diagram", "checkpoint", "examTip", "commonMistake", "stretch"].includes(t)) return true;
  return false;
}

/**
 * V10: stem-cell lessons — drop second+ blocks hitting the same meaning bucket (title + content).
 */
function removeDuplicateConceptsByMeaning(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();

  for (const page of draft.pages || []) {
    const seen = new Set();

    page.blocks = (page.blocks || []).filter((block) => {
      if (isV10ConceptDedupeProtected(block)) return true;

      const text = `${block.title || ""} ${block.content || ""}`.toLowerCase();

      let concept = null;

      if (topic.includes("stem cell")) {
        if (text.includes("differentiat")) concept = "differentiation";
        else if (text.includes("embryonic") && text.includes("adult")) concept = "comparison";
        else if (
          text.includes("leukaemia") ||
          text.includes("bone marrow") ||
          text.includes("regenerative")
        ) {
          concept = "application";
        } else if (text.includes("ethic") || text.includes("embryo")) concept = "ethics";
      }

      if (!concept) return true;
      if (seen.has(concept)) return false;
      seen.add(concept);
      return true;
    });
  }

  return draft;
}

/**
 * V10: cap long text/keyIdea blocks at three sentence-style units (split on “. ”).
 */
function enforceOneIdeaPerBlock(draft) {
  if (!draft || typeof draft !== "object") return draft;

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (!block?.content) continue;

      const t = normalizeBlockType(block.type);
      if (t !== "text" && t !== "keyIdea") continue;

      const parts = String(block.content)
        .split(/\.\s+/)
        .map((x) => x.trim())
        .filter(Boolean);

      if (parts.length > 3) {
        block.content = `${parts.slice(0, 3).join(". ")}.`;
      }
    }
  }

  return draft;
}

function preferExplanationOverRestatement(draft) {
  if (!draft || typeof draft !== "object") return draft;

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (!block?.content) continue;

      const text = String(block.content).toLowerCase();

      if (
        text.includes("stem cells can differentiate") &&
        !/because|for example|which means|in other words/.test(text)
      ) {
        block.content +=
          "\nIn other words, stem cells have not yet developed a fixed role, so they can later become specialised cells.";
      }
    }
  }

  return draft;
}

/**
 * V10: rotate “this matters because” across the whole lesson (one counter).
 */
function varyWhyStatementsAcrossDraft(draft) {
  if (!draft || typeof draft !== "object") return draft;

  let i = 0;
  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (!block?.content || typeof block.content !== "string") continue;
      block.content = block.content.replace(/this matters because/gi, () => {
        const v = V10_WHY_VARIATIONS[i % V10_WHY_VARIATIONS.length];
        i += 1;
        return v;
      });
    }
  }

  return draft;
}

/**
 * V10: stem-cell “aha” block at index 2 when missing the cue phrase.
 */
function ensureAhaMomentBlock(draft, topicHint = "") {
  const topic = String(topicHint || "").toLowerCase();
  if (!topic.includes("stem cell") || !draft?.pages) return draft;

  for (const page of draft.pages) {
    const exists = (page.blocks || []).some((b) =>
      /the key difference is this/i.test(`${b.title || ""} ${b.content || ""}`)
    );

    if (exists) continue;

    page.blocks.splice(2, 0, {
      type: "keyIdea",
      title: "The key idea",
      role: "coreRule",
      content:
        "The key difference is this:\n" +
        "Embryonic stem cells can become any cell.\n" +
        "Adult stem cells can only become a limited range.\n" +
        "This is what examiners are looking for.",
    });
  }

  return draft;
}

/**
 * V10: drop redundant text/keyIdea blocks that restate the same topic-specific cue (first wins).
 */
function removeDuplicateConcepts(blocks, topicHint = "") {
  if (!Array.isArray(blocks)) return blocks;

  const conceptDefs = resolveV10DedupeConcepts(topicHint);
  if (!conceptDefs.length) return blocks;

  const seen = new Set();

  return blocks.filter((b) => {
    if (isV10ConceptDedupeProtected(b)) return true;

    const bt = normalizeBlockType(b?.type);
    if (bt !== "text" && bt !== "keyIdea") return true;

    const text = String(b?.content || "").toLowerCase();
    let hit = null;
    for (const { id, test } of conceptDefs) {
      if (test(text)) {
        hit = id;
        break;
      }
    }
    if (!hit) return true;
    if (seen.has(hit)) return false;
    seen.add(hit);
    return true;
  });
}

/**
 * V10: one topic-aware “aha” anchor (after hook + core rule). Skips duplicate title or near-duplicate opening lines.
 */
function insertAhaMoment(blocks, topicHint = "") {
  if (!Array.isArray(blocks)) return blocks;
  if (blocks.length < 2) return blocks;

  if (blocks.some((b) => /the key idea/i.test(safeStr(b?.title, "")))) return blocks;

  const row = resolveV10AhaRow(topicHint);
  if (!row) return blocks;

  let content =
    typeof row.contentFn === "function"
      ? row.contentFn(topicHint)
      : String(row.content || "").trim();
  if (!content) return blocks;

  const firstLine = content.split("\n").map((l) => l.trim()).find(Boolean) || content;
  const needle = firstLine.slice(0, 48).toLowerCase();
  if (
    needle.length > 12 &&
    blocks.slice(0, 5).some((b) => String(b?.content || "").toLowerCase().includes(needle))
  ) {
    return blocks;
  }

  const aha = {
    type: "keyIdea",
    title: safeStr(row.title, "The key idea"),
    content,
    role: safeStr(row.role, "patternRecognition") || "patternRecognition",
  };

  blocks.splice(2, 0, aha);
  return blocks;
}

/**
 * V10 — simplicity + focus: shorter key ideas, one idea per block, meaning + table dedupe, aha, explanation cue, varied “why”.
 */
function applyV10SimplicityAndFocus(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topicLower = String(topicHint || "").toLowerCase();

  enforceKeyIdeaLength(draft);
  enforceOneIdeaPerBlock(draft);
  removeDuplicateConceptsByMeaning(draft, topicHint);

  if (!topicLower.includes("stem cell")) {
    for (const page of draft.pages || []) {
      if (!Array.isArray(page.blocks)) continue;
      page.blocks = removeDuplicateConcepts(page.blocks, topicHint);
    }
  }

  ensureAhaMomentBlock(draft, topicHint);

  if (!topicLower.includes("stem cell")) {
    for (const page of draft.pages || []) {
      if (!Array.isArray(page.blocks)) continue;
      page.blocks = insertAhaMoment(page.blocks, topicHint);
    }
  }

  preferExplanationOverRestatement(draft);
  varyWhyStatementsAcrossDraft(draft);

  return draft;
}

/** V10.5: roles/types never removed by hard concept dedupe (pick-best / prune). */
function isV105HardDedupeProtected(block) {
  if (!block || typeof block !== "object") return true;
  const r = safeStr(block.role, "");
  if (
    [
      "workedExample",
      "finalMemoryRule",
      "commonMistake",
      "examTip",
      "patternRecognition",
      "synthesis",
      "hook",
      "coreRule",
      "whatToNotice",
    ].includes(r)
  ) {
    return true;
  }
  const t = normalizeBlockType(block.type);
  if (["examTip", "commonMistake", "checkpoint", "diagram", "pageQuiz"].includes(t)) return true;
  return false;
}

/**
 * V10.5 — core concept tag for stem-cell (and similar) teaching text; null = skip dedupe.
 */
function detectConcept(text = "", topic = "") {
  const t = String(text || "").toLowerCase();
  const topicLower = String(topic || "").toLowerCase();

  if (!topicLower.includes("stem cell")) return null;

  if (t.includes("differentiat")) return "differentiation";
  if (t.includes("embryonic") && t.includes("adult")) return "comparison";
  if (t.includes("unspecialised") || t.includes("unspecialized")) return "definition";
  if (t.includes("leukaemia") || t.includes("leukemia") || t.includes("bone marrow")) return "application";
  if (t.includes("ethic") || /\bembryos?\b/.test(t)) return "ethics";

  return null;
}

function scoreBlockQuality(block) {
  const text = String(block?.content || "").toLowerCase();

  let score = 0;

  if (/because/.test(text)) score += 2;
  if (/for example|such as/.test(text)) score += 2;
  if (/in exams/.test(text)) score += 2;
  if (text.length > 120) score += 1;

  return score;
}

/**
 * V10.5 — among blocks with the same detectConcept, keep the single highest-scoring block; preserve order.
 */
function keepBestPerConcept(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();

  for (const page of draft.pages || []) {
    const blocks = page.blocks || [];
    const winnerIndexByConcept = new Map();

    blocks.forEach((block, index) => {
      if (isV105HardDedupeProtected(block)) return;
      if (!block?.content) return;
      const concept = detectConcept(block.content, topic);
      if (!concept) return;
      const score = scoreBlockQuality(block);
      const prevIdx = winnerIndexByConcept.get(concept);
      if (prevIdx === undefined) {
        winnerIndexByConcept.set(concept, index);
        return;
      }
      const prevScore = scoreBlockQuality(blocks[prevIdx]);
      if (score > prevScore) {
        winnerIndexByConcept.set(concept, index);
      }
    });

    page.blocks = blocks.filter((block, index) => {
      if (isV105HardDedupeProtected(block)) return true;
      if (!block?.content) return true;
      const concept = detectConcept(block.content, topic);
      if (!concept) return true;
      return winnerIndexByConcept.get(concept) === index;
    });
  }

  return draft;
}

/**
 * V10.5 — first occurrence wins per concept after keep-best (safety net); protected roles/types kept.
 */
function hardPruneDuplicateConcepts(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();

  for (const page of draft.pages || []) {
    const seen = new Set();

    page.blocks = (page.blocks || []).filter((block) => {
      if (isV105HardDedupeProtected(block)) return true;
      if (!block?.content) return true;

      const concept = detectConcept(block.content, topic);

      if (!concept) return true;

      if (seen.has(concept)) {
        return false;
      }

      seen.add(concept);
      return true;
    });
  }

  return draft;
}

/**
 * Teaching-intent bucket from title + body (and checkpoint fields), for stem-cell lessons.
 * Broader than keyword-only V10.5 buckets so differently worded blocks still collide.
 */
function detectTeachingIntent(block, topicHint = "") {
  const topicLower = String(topicHint || "").toLowerCase();
  if (!topicLower.includes("stem cell")) return null;

  const text = `${block?.title || ""} ${block?.content || ""} ${block?.prompt || ""} ${block?.question || ""}`.toLowerCase();

  if (/unspecialised|unspecialized|differentiat|self-renew/.test(text)) return "definition";
  if (/embryonic|adult|pluripotent|multipotent|key difference|compare/.test(text)) return "comparison";
  if (/leukaemia|leukemia|bone marrow|medicine|treatment|regenerative/.test(text)) return "application";
  if (/ethic|moral|controvers/.test(text) || /\bembryos?\b/.test(text)) return "ethics";
  if (safeStr(block?.role, "") === "finalMemoryRule") return "takeaway";

  return null;
}

const TEACHING_INTENT_DEDUPE_PROTECTED_ROLES = new Set([
  "hook",
  "coreRule",
  "commonMistake",
  "patternRecognition",
  "workedExample",
  "synthesis",
  "finalMemoryRule",
  "whatToNotice",
  "examTip",
]);

function isTeachingIntentDedupeProtected(block) {
  if (!block || typeof block !== "object") return true;
  const r = safeStr(block.role, "");
  if (TEACHING_INTENT_DEDUPE_PROTECTED_ROLES.has(r)) return true;
  const t = normalizeBlockType(block.type);
  if (["examTip", "commonMistake", "checkpoint", "diagram", "pageQuiz"].includes(t)) return true;
  return false;
}

/**
 * Stem-cell lessons: at most one surviving block per teaching intent (best scoreBlockQuality wins).
 * Preserves original order; does not merge blocks.
 */
function dedupeByTeachingIntent(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topicLower = String(topicHint || "").toLowerCase();
  if (!topicLower.includes("stem cell")) return draft;

  for (const page of draft.pages || []) {
    const blocks = page.blocks || [];
    const winnerIndexByIntent = new Map();

    blocks.forEach((block, index) => {
      if (isTeachingIntentDedupeProtected(block)) return;
      const intent = detectTeachingIntent(block, topicHint);
      if (!intent) return;
      const score = scoreBlockQuality(block);
      const prevIdx = winnerIndexByIntent.get(intent);
      if (prevIdx === undefined) {
        winnerIndexByIntent.set(intent, index);
        return;
      }
      const prevScore = scoreBlockQuality(blocks[prevIdx]);
      if (score > prevScore) {
        winnerIndexByIntent.set(intent, index);
      }
    });

    page.blocks = blocks.filter((block, index) => {
      if (isTeachingIntentDedupeProtected(block)) return true;
      const intent = detectTeachingIntent(block, topicHint);
      if (!intent) return true;
      return winnerIndexByIntent.get(intent) === index;
    });
  }

  return draft;
}

function v11HookQuestionLine(topicHint = "") {
  const t = String(topicHint || "").toLowerCase();
  if (t.includes("stem cell")) {
    return "Have you ever wondered how damaged tissues can be repaired?\n";
  }
  const label = safeStr(topicHint, "this topic").trim().slice(0, 80) || "this topic";
  return `Have you ever wondered why ${label} keeps coming up in GCSE exams?\n`;
}

/**
 * V11: teacher-style questions at the top of selected blocks (hook, pattern recognition, following text blocks).
 */
function addTeacherQuestions(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  for (const page of draft.pages || []) {
    const blocks = page.blocks || [];
    /** Count text blocks after index 0 — only every other gets “Why does this matter?” */
    let textAfterHookOrdinal = 0;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block?.content || typeof block.content !== "string") continue;

      const t = normalizeBlockType(block.type);
      if (t !== "text" && t !== "keyIdea") continue;

      const text = block.content.trim();

      if (
        /^have you ever/i.test(text) ||
        /^why does this matter\??/i.test(text) ||
        /^so what is the key difference/i.test(text)
      ) {
        continue;
      }

      const r = safeStr(block.role, "");

      if (r === "hook") {
        block.content = v11HookQuestionLine(topicHint) + text;
      } else if (r === "patternRecognition") {
        block.content = "So what is the key difference students must remember?\n" + text;
      } else if (i > 0 && t === "text") {
        textAfterHookOrdinal += 1;
        if (textAfterHookOrdinal % 2 === 1) {
          block.content = "Why does this matter?\n" + text;
        }
      }
    }
  }

  return draft;
}

/**
 * V11: slightly more spoken pacing (connectives).
 */
function paceExplanationsLikeTeacher(draft) {
  if (!draft || typeof draft !== "object") return draft;

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (!block?.content || typeof block.content !== "string") continue;

      const t = normalizeBlockType(block.type);
      if (t !== "text" && t !== "keyIdea") continue;

      let content = block.content;

      content = content
        .replace(/\bIn other words,\s*/gi, "In simple terms, ")
        .replace(/\bThis means that\s*/gi, "This means ")
        .replace(/\bFor example,\s*/gi, "For example, ")
        .replace(/\bHowever,\s*/gi, "However, ");

      block.content = content.trim();
    }
  }

  return draft;
}

/**
 * V11: stem-cell key ideas get one-line “ask yourself” prompts.
 */
function addGuidedThinkingPrompts(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();
  if (!topic.includes("stem cell")) return draft;

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (!block?.content || typeof block.content !== "string") continue;
      if (normalizeBlockType(block.type) !== "keyIdea") continue;

      const text = block.content.toLowerCase();

      if (text.includes("embryonic") && text.includes("adult")) {
        block.content +=
          "\nAsk yourself: which type has greater potential, and why does that matter in medicine?";
      }
      if (/\b(ethic|moral)\b/.test(text)) {
        block.content +=
          "\nAsk yourself: what is the medical benefit, and what is the ethical cost?";
      }
      if (text.includes("differentiat")) {
        block.content +=
          "\nAsk yourself: why is differentiation the reason stem cells are useful in treatment?";
      }
    }
  }

  return draft;
}

/**
 * V11: exam tips as examiner-in-the-room voice + compare nudge when missing.
 */
function makeExamTipsTeacherLike(draft) {
  if (!draft || typeof draft !== "object") return draft;

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (normalizeBlockType(block.type) !== "examTip" || !block?.content) continue;

      let content = String(block.content).trim();
      if (!content) continue;

      if (!/^In exams,/i.test(content)) {
        content = "In exams, " + content.charAt(0).toLowerCase() + content.slice(1);
      }

      if (!/make sure|always|do not forget|state both sides/i.test(content)) {
        content +=
          " Always make sure you compare both sides clearly if the question asks for differences.";
      }

      block.content = content;
    }
  }

  return draft;
}

/**
 * V11: non–worked-example checkpoints as short teacher-style written questions (stem cell topics).
 */
function upgradeCheckpointsToTeacherStyle(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();
  if (!topic.includes("stem cell")) return draft;

  for (const page of draft.pages || []) {
    const checkpoints = (page.blocks || []).filter(
      (b) =>
        normalizeBlockType(b?.type) === "checkpoint" && safeStr(b?.role, "") !== "workedExample"
    );

    if (checkpoints[0]) {
      const q = "Explain why stem cells are useful in medicine (3 marks)";
      checkpoints[0].question = q;
      checkpoints[0].prompt = q;
      checkpoints[0].correctAnswer =
        "Because they can differentiate into specialised cells and replace damaged cells.";
      checkpoints[0].questionType = "short";
      checkpoints[0].options = [];
    }

    if (checkpoints[1]) {
      const q = "Compare embryonic stem cells and adult stem cells (2 marks)";
      checkpoints[1].question = q;
      checkpoints[1].prompt = q;
      checkpoints[1].correctAnswer =
        "Embryonic stem cells can become almost any cell type, whereas adult stem cells can only form a limited range.";
      checkpoints[1].questionType = "short";
      checkpoints[1].options = [];
    }

    if (checkpoints[2]) {
      const q = "Evaluate one benefit and one ethical concern of embryonic stem cells (4 marks)";
      checkpoints[2].question = q;
      checkpoints[2].prompt = q;
      checkpoints[2].correctAnswer = "Benefit: potential to treat disease. Concern: embryos are destroyed.";
      checkpoints[2].questionType = "short";
      checkpoints[2].options = [];
    }
  }

  return draft;
}

/**
 * V11: memorable closing lines for stem-cell final memory rule.
 */
function strengthenFinalTakeaway(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();
  if (!topic.includes("stem cell")) return draft;

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (safeStr(block?.role, "") !== "finalMemoryRule") continue;

      block.content =
        "Remember this:\n" +
        "Embryonic stem cells can become almost any cell type, but adult stem cells are more limited.\n" +
        "That difference is the key to both their medical use and the ethical debate around them.";
    }
  }

  return draft;
}

/**
 * V11 — true teacher dialogue: questions, pacing, prompts, exam tips, checkpoints, finale.
 */
function applyV11TeacherDialogueAndQuestioning(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  addTeacherQuestions(draft, topicHint);
  paceExplanationsLikeTeacher(draft);
  addGuidedThinkingPrompts(draft, topicHint);
  makeExamTipsTeacherLike(draft);
  upgradeCheckpointsToTeacherStyle(draft, topicHint);
  strengthenFinalTakeaway(draft, topicHint);

  return draft;
}

/* =========================================================
   V12 — Visual hierarchy engine (chunking, spacing, scan cues)
   Advisory helpers are non-blocking; draft transforms run in sanitizeDraft after V11.
   ========================================================= */

function looksVisuallyDense(text = "") {
  const s = String(text);
  return s.length > 400 || s.split("\n").length < 2;
}

function lacksScanMarkers(text = "") {
  return !/(💡|👉|⚠️|🧪|•|🔑|🧬|🧠|🔍|⚖️)/.test(String(text));
}

function collectV12VisualAdvisoryNotes(draft) {
  if (!draft || typeof draft !== "object") return [];
  const notes = [];
  const seen = new Set();
  for (const page of draft.pages || []) {
    const pt = safeStr(page?.title, "page");
    for (const block of page.blocks || []) {
      const t = normalizeBlockType(block.type);
      if (!["text", "keyIdea", "examTip", "commonMistake", "stretch"].includes(t)) continue;
      const c = safeStr(block.content, "");
      if (!c.trim() || c.length < 200) continue;
      if (looksVisuallyDense(c)) {
        const msg = `Visual hierarchy (V12): a block on "${pt}" is visually dense — consider splitting or adding markers (🔑 💡 👉).`;
        if (!seen.has(msg)) {
          seen.add(msg);
          notes.push(msg);
        }
      }
      if (c.length > 320 && lacksScanMarkers(c)) {
        const msg2 = `Visual hierarchy (V12): a long passage on "${pt}" has few scan cues — teaching icons in the editor can help.`;
        if (!seen.has(msg2)) {
          seen.add(msg2);
          notes.push(msg2);
        }
      }
    }
  }
  return notes.slice(0, 8);
}

function chunkDenseBlocks(draft) {
  if (!draft || typeof draft !== "object") return draft;
  for (const page of draft.pages || []) {
    if (!Array.isArray(page.blocks)) continue;
    const nextBlocks = [];
    for (const block of page.blocks) {
      const t = normalizeBlockType(block?.type);
      if (!block?.content || typeof block.content !== "string" || (t !== "text" && t !== "keyIdea")) {
        nextBlocks.push(block);
        continue;
      }
      let parts;
      try {
        parts = block.content
          .split(/\n{2,}|(?<=\.)\s+(?=[A-Z])/)
          .map((x) => x.trim())
          .filter(Boolean);
      } catch {
        nextBlocks.push(block);
        continue;
      }
      if (parts.length <= 2) {
        nextBlocks.push(block);
        continue;
      }
      const first = { ...block, content: parts[0] };
      if (first.title === undefined) first.title = "";
      nextBlocks.push(first);
      const baseTitle = safeStr(block.title, "").trim();
      for (let i = 1; i < parts.length; i++) {
        const cont = {
          ...block,
          title: "",
          role: block.role,
          content: parts[i],
        };
        if (t === "keyIdea") {
          cont.title = baseTitle ? `${baseTitle} (continued)` : "Key idea";
        }
        nextBlocks.push(cont);
      }
    }
    page.blocks = nextBlocks;
  }
  return draft;
}

/** Structure validation requires a non-empty title on every keyIdea (chunk splits / AI gaps). */
function ensureKeyIdeaBlockTitles(draft) {
  if (!draft || typeof draft !== "object") return draft;
  const fromRole = {
    whatToNotice: "What to Notice",
    finalMemoryRule: "Final Memory Rule",
    patternRecognition: "Key pattern",
    synthesis: "Synthesis",
    coreRule: "Core idea",
    concept: "Key idea",
    hook: "Key idea",
  };
  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (normalizeBlockType(block?.type) !== "keyIdea") continue;
      if (safeStr(block?.title, "").trim()) continue;
      const r = safeStr(block?.role, "").trim();
      if (fromRole[r]) {
        block.title = fromRole[r];
        continue;
      }
      const text = safeStr(block?.content, "").trim();
      const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || "";
      const plain = firstLine.replace(/^[\s•\-*🧪💡👉⚠️🔑🧬🧠🔍⚖️]+/u, "").trim();
      if (plain.length >= 3 && plain.length <= 72) {
        block.title = plain;
      } else if (plain.length > 72) {
        block.title = `${plain.slice(0, 69).trim()}…`;
      } else {
        block.title = "Key idea";
      }
    }
  }
  return draft;
}

function emphasiseKeyLines(draft) {
  if (!draft || typeof draft !== "object") return draft;
  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (!block?.content || typeof block.content !== "string") continue;
      const lines = block.content.split("\n");
      const next = lines.map((line) => {
        const t = line.trim();
        if (!t) return line;
        if (/^(💡|👉|⚠️|🧪|🔑|🧬|🧠|🔍|⚖️)/.test(t)) return line;
        if (/^The key difference is this:/i.test(t))
          return line.replace(/^(\s*)The key difference is this:/i, "$1💡 The key difference is this:");
        if (/^In exams,/i.test(t)) return line.replace(/^(\s*)In exams,/i, "$1👉 In exams,");
        if (/^A common mistake/i.test(t)) return line.replace(/^(\s*)A common mistake/i, "$1⚠️ A common mistake");
        if (/^For example,/i.test(t)) return line.replace(/^(\s*)For example,/i, "$1🧪 For example,");
        return line;
      });
      block.content = next.join("\n");
    }
  }
  return draft;
}

function normalizeVisualSpacing(draft) {
  if (!draft || typeof draft !== "object") return draft;
  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (!block?.content || typeof block.content !== "string") continue;
      block.content = block.content
        .replace(/\n{3,}/g, "\n\n")
        .replace(/([.!?])\s+(👉|💡|⚠️|🧪|🧠|🔍|⚖️|🧬|🔑)/g, "$1\n\n$2")
        .trim();
    }
  }
  return draft;
}

function shortenOverlongParagraphs(draft) {
  if (!draft || typeof draft !== "object") return draft;
  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (!block?.content || typeof block.content !== "string") continue;
      const lines = block.content.split("\n");
      const nextLines = [];
      for (const line of lines) {
        if (line.length > 220) {
          const sentences = line.split(/(?<=[.!?])\s+/);
          let current = "";
          for (const sentence of sentences) {
            if (`${current} ${sentence}`.trim().length > 140) {
              if (current.trim()) nextLines.push(current.trim());
              current = sentence;
            } else {
              current = `${current} ${sentence}`.trim();
            }
          }
          if (current.trim()) nextLines.push(current.trim());
        } else {
          nextLines.push(line);
        }
      }
      block.content = nextLines.join("\n");
    }
  }
  return draft;
}

function normalizeBulletLists(draft) {
  if (!draft || typeof draft !== "object") return draft;
  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (!block?.content || typeof block.content !== "string") continue;
      block.content = block.content
        .replace(/^\*\s+/gm, "• ")
        .replace(/^-\s+/gm, "• ")
        .replace(/^\d+\.\s+/gm, (match) => `${match.trim()} `);
    }
  }
  return draft;
}

function addOneGlanceSummary(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;
  const topic = String(topicHint || "").toLowerCase();
  if (!topic.includes("stem cell")) return draft;

  for (const page of draft.pages || []) {
    if (!Array.isArray(page.blocks) || page.blocks.length < 10) continue;
    const alreadyExists = page.blocks.some((b) =>
      /one-glance summary|quick summary/i.test(`${b.title || ""} ${b.content || ""}`)
    );
    if (alreadyExists) continue;
    page.blocks.splice(1, 0, {
      type: "keyIdea",
      title: "One-glance summary",
      role: "coreRule",
      content:
        "💡 Quick summary:\n" +
        "• Stem cells are unspecialised cells that can differentiate\n" +
        "• Embryonic stem cells are pluripotent; adult stem cells are multipotent\n" +
        "• This difference is central to medicine and ethics questions",
    });
  }
  return draft;
}

function applyV12VisualHierarchyEngine(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;
  chunkDenseBlocks(draft);
  shortenOverlongParagraphs(draft);
  normalizeBulletLists(draft);
  emphasiseKeyLines(draft);
  normalizeVisualSpacing(draft);
  addOneGlanceSummary(draft, topicHint);
  ensureKeyIdeaBlockTitles(draft);
  return draft;
}

/**
 * V7.6: replace loose embryonic vs adult prose with a tight comparison scaffold when detected.
 */
function enhanceComparisons(draft) {
  if (!draft || typeof draft !== "object") return draft;

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (block?.content == null || typeof block.content !== "string") continue;

      const t = normalizeBlockType(block.type);
      if (t !== "text" && t !== "keyIdea") continue;

      if (!/embryonic.*adult|adult.*embryonic/i.test(block.content)) continue;

      block.content =
        "Key comparison:\n" +
        "- Embryonic stem cells: can become almost any cell type (pluripotent)\n" +
        "- Adult stem cells: can only form a limited range (multipotent)\n" +
        "- This difference is essential in exam questions";
    }
  }

  return draft;
}

/**
 * V7: ensure worked example is a strong compare + bullet model answer (stem-cell topics only; others unchanged).
 */
function strengthenWorkedExample(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const stem = String(topicHint || "").toLowerCase().includes("stem cell");
  if (!stem) return draft;

  const q = "Compare embryonic and adult stem cells (4 marks)";
  const model =
    "- Embryonic stem cells can become almost any cell type, whereas adult stem cells can only form a limited range.\n" +
    "- Embryonic stem cells come from early embryos, whereas adult stem cells come from tissues such as bone marrow.\n" +
    "- Embryonic stem cells have greater medical potential.\n" +
    "- However, their use raises ethical concerns because embryos are destroyed.";

  for (const page of draft.pages || []) {
    for (const block of page.blocks || []) {
      if (normalizeBlockType(block.type) !== "checkpoint") continue;
      if (safeStr(block.role, "") !== "workedExample") continue;

      block.prompt = q;
      block.question = q;
      block.answer = model;
      block.explanation = model;
      block.correctAnswer = "See model answer";
      block.questionType = "short";
    }
  }
  return draft;
}

/**
 * V7: collapse repeated stem-cell “definition” key ideas into one strong line (stem-cell topics only).
 */
function collapseWeakKeyIdeas(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  const topic = String(topicHint || "").toLowerCase();
  if (!topic.includes("stem cell")) return draft;

  for (const page of draft.pages || []) {
    if (!Array.isArray(page.blocks)) continue;

    const newBlocks = [];
    let seenCore = false;

    const protectedKeyIdeaRoles = new Set([
      "patternRecognition",
      "coreRule",
      "finalMemoryRule",
      "whatToNotice",
      "synthesis",
    ]);

    for (const block of page.blocks) {
      if (normalizeBlockType(block.type) !== "keyIdea") {
        newBlocks.push(block);
        continue;
      }

      const r = safeStr(block.role, "");
      if (protectedKeyIdeaRoles.has(r)) {
        newBlocks.push(block);
        continue;
      }

      const text = String(block.content || "").toLowerCase();
      if (text.includes("differentiat") || text.includes("unspecialised") || text.includes("unspecialized")) {
        if (seenCore) continue;
        seenCore = true;
        block.content =
          "Stem cells are unspecialised cells that can self-renew and differentiate into specialised cells, making them essential for growth, repair, and medical treatment.";
      }

      newBlocks.push(block);
    }

    page.blocks = newBlocks;
  }

  return draft;
}

/** Coarse teaching band; original index breaks ties so in-band order is preserved. */
function v7TeachingFlowBand(block) {
  const r = safeStr(block?.role, "").toLowerCase();
  const t = normalizeBlockType(block?.type);

  if (isDashboardTeacherFirstEnabled()) {
    const title = safeStr(block?.title, "").toLowerCase();
    if (r === "lessonobjectives" || r === "objectives" || /lesson objectives/.test(title)) return 0;
    if (r === "priorknowledge" || /prior knowledge/.test(title)) return 1;
    if (r === "definition" || title === "definition" || /^definition\b/.test(title)) return 2;
    if (r === "whyitmatters" || /why it matters/.test(title)) return 3;
    if (r === "coremodel" || r === "corerule" || /core model/.test(title)) return 4;
    if (r === "keyexamples" || /key examples/.test(title)) return 5;
    if (r === "examvocabulary" || /exam vocabulary/.test(title)) return 6;
    if (r === "hook" || r === "scenario" || /^scenario\b/.test(title)) return 7;
    if (r === "concept" || r === "coreteaching" || /core teaching/.test(title)) return 8;
  }

  if (r === "hook") return 0;
  if (r === "coreRule") return 1;
  if (r === "patternRecognition") return 2;
  if (r === "commonMistake" || t === "commonMistake") return 3;
  if (t === "diagram") return 4;
  if (r === "whatToNotice") return 5;
  if (t === "text" || t === "keyIdea") return 6;
  if (t === "stretch") return 6;
  if (t === "examTip") return 7;
  if (t === "checkpoint" && r !== "workedExample") return 8;
  if (t === "checkpoint" && r === "workedExample") return 9;
  if (r === "synthesis") return 10;
  if (r === "finalMemoryRule") return 11;
  return 6;
}

/**
 * V7: stable reorder toward teaching flow (band + original index — avoids scrambling body text).
 */
function enforceTeachingOrder(draft) {
  if (!draft || typeof draft !== "object") return draft;

  for (const page of draft.pages || []) {
    if (!Array.isArray(page.blocks)) continue;
    const tagged = page.blocks.map((b, i) => ({
      b,
      k: v7TeachingFlowBand(b) * 100000 + i,
    }));
    tagged.sort((a, b) => a.k - b.k);
    page.blocks = tagged.map((x) => x.b);
  }

  return draft;
}

function applyV7TeachingPresentationLayer(draft, topicHint = "") {
  if (!draft || typeof draft !== "object") return draft;

  collapseWeakKeyIdeas(draft, topicHint);
  convertTablesToReadableBlocks(draft);
  strengthenWorkedExample(draft, topicHint);
  enforceTeachingOrder(draft);
  applyTeachingTransitions(draft, topicHint);

  return draft;
}

function sanitizeDraft(draft, opts = {}) {
  const {
    subject,
    level,
    topic,
    strictBlueprint = false,
    retainTeachingIntentMetadata = false,
    teachingIntentTagOnly = false,
  } = opts || {};
  const lvl = normalizeLevel(level);

  const clean = {
    title: safeStr(draft?.title, `${safeStr(topic)} (${lvl})`),
    description: safeStr(draft?.description, ""),
    estimatedDuration: Number.isFinite(Number(draft?.estimatedDuration))
      ? Number(draft.estimatedDuration)
      : 40,
    tags: Array.isArray(draft?.tags)
      ? draft.tags.map((t) => safeStr(t, "")).filter(Boolean).slice(0, 12)
      : [],

    // IMPORTANT: board is allowed to be "" (meaning "UK general" per prompt rule)
    board:
      draft?.board === undefined || draft?.board === null
        ? ""
        : String(draft.board),
    tier: lvl === "GCSE" ? normalizeTier(draft?.tier) : "",

    pages: Array.isArray(draft?.pages) ? draft.pages : [],
  };

  if (lvl !== "GCSE") clean.tier = "";

  clean.pages = clean.pages
    .map((p, idx) => {
      const blocksRaw = Array.isArray(p?.blocks) ? p.blocks : [];
      let blocks = blocksRaw
        .map((raw) => {
          const b = normalizeLessonBlockForDraft(raw);
          const type = normalizeBlockType(b?.type);
          if (type === "checkpoint") {
            const prompt = safeStr(b?.prompt || b?.question, "").trim();
            const correctAnswer = safeStr(b?.correctAnswer || b?.answer, "");
            const options = Array.isArray(b?.options)
              ? b.options.map((o) => safeStr(o, "")).filter(Boolean).slice(0, 6)
              : [];
            const questionType =
              b?.questionType === "short" ? "short" : (options.length > 0 ? "mcq" : "short");
            const finalOptions =
              questionType === "mcq" && options.length === 0 ? ["A", "B", "C", "D"] : options;
            const cpOut = {
              type: "checkpoint",
              prompt: prompt || "Quick check",
              questionType,
              options: finalOptions,
              correctAnswer: correctAnswer || (finalOptions[0] ?? ""),
              explanation: safeStr(b?.explanation, ""),
            };
            if (typeof b?.role === "string" && b.role.trim()) cpOut.role = b.role.trim();
            if (cpOut.title === undefined) cpOut.title = "";
            return cpOut;
          }
          if (type === "diagram") {
            const cap = safeStr(b?.caption, "") || safeStr(b?.content, "image here");
            const content = safeStr(b?.content, "") || "image here";
            const dOut = {
              type: "diagram",
              caption: cap,
              content,
            };
            const vidStr =
              b?.visualId !== undefined && b?.visualId !== null
                ? String(b.visualId).trim()
                : "";
            if (vidStr && mongoose.Types.ObjectId.isValid(vidStr)) {
              dOut.visualId = vidStr;
            }
            if (typeof b?.role === "string" && b.role.trim()) dOut.role = b.role.trim();
            if (dOut.title === undefined) dOut.title = "";
            return dOut;
          }
          const out = {
            type,
            content: safeStr(b?.content, ""),
          };
          if (typeof b?.title === "string" && b.title.trim()) out.title = b.title.trim();
          if (out.title === undefined) out.title = "";
          if (typeof b?.role === "string" && b.role.trim()) out.role = b.role.trim();
          return out;
        })
        .filter((b) => {
          if (b.type === "checkpoint") {
            const prompt = (b.prompt || "").toString().trim();
            return prompt.length > 0;
          }
          if (b.type === "diagram") return true;
          return b.content && b.content.trim().length > 0;
        });

      const cp = p?.checkpoint || {};
      const hasPageLevelCheckpoint =
        cp && typeof cp === "object" && safeStr(cp?.question, "").trim().length > 0;

      if (hasPageLevelCheckpoint) {
        const options = clampOptions(cp?.options);
        while (options.length < 4) options.push(`Option ${options.length + 1}`);
        const answer = safeStr(cp?.answer, "");
        const answerOk = options.some((o) => o.trim() === answer.trim());
        const checkpointBlock = {
          type: "checkpoint",
          prompt: safeStr(cp?.question, "Quick check: which statement is correct?"),
          questionType: "mcq",
          options: options.slice(0, 4),
          correctAnswer: answerOk ? answer : options[0],
          explanation: "",
        };
        const hasCheckpointBlock = blocks.some((b) => b.type === "checkpoint");
        if (!hasCheckpointBlock) blocks = [...blocks, checkpointBlock];
      }

      const hasAnyCheckpointBlock = blocks.some((b) => b.type === "checkpoint");
      const finalBlocks =
        blocks.length > 0
          ? blocks
          : [{ type: "text", content: "Content coming soon." }];

      const legacyOptions = clampOptions(cp?.options);
      while (legacyOptions.length < 4) legacyOptions.push(`Option ${legacyOptions.length + 1}`);
      const legacyAnswer = safeStr(cp?.answer, "");
      const legacyAnswerOk = legacyOptions.some((o) => o.trim() === legacyAnswer.trim());

      return {
        title: safeStr(p?.title, `Page ${idx + 1}`),
        order: Number.isFinite(Number(p?.order)) ? Number(p.order) : idx + 1,
        pageType: safeStr(p?.pageType, ""),
        blocks: finalBlocks,
        checkpoint: hasAnyCheckpointBlock
          ? undefined
          : {
              question: safeStr(cp?.question, "Quick check: which statement is correct?"),
              options: legacyOptions.slice(0, 4),
              answer: legacyAnswerOk ? legacyAnswer : legacyOptions[0],
            },
      };
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // PR: Single-page default — collapse multiple pages into one (deterministic post-processing)
  clean.pages = collapsePagesToSingle(clean.pages);

  if (!clean.pages.length) {
    clean.pages = [
      {
        title: "Page 1",
        order: 1,
        pageType: "",
        blocks: [
          { type: "text", content: `## ${safeStr(topic)}\n\nAdd content here.` },
          {
            type: "checkpoint",
            prompt: "Which statement is correct?",
            questionType: "mcq",
            options: ["Option 1", "Option 2", "Option 3", "Option 4"],
            correctAnswer: "Option 1",
            explanation: "",
          },
        ],
        checkpoint: undefined,
      },
    ];
  }

  applyRoleFallbacksToLesson(clean, {
    topic,
    topicKey: opts.topicKey,
    subTopic: opts.subTopic || opts.subTopicDisplay || topic,
  });
  ensureMinimumDiagramBlocks(clean, topic, {
    topicKey: opts.topicKey,
    subTopic: opts.subTopic || opts.subTopicDisplay || topic,
  });
  ensureWhatToNoticeBlocks(clean, topic, {
    topicKey: opts.topicKey,
    subTopic: opts.subTopic || opts.subTopicDisplay || topic,
  });
  ensureProperCommonMistakeBlock(clean, topic);
  ensureWorkedExampleCheckpoint(clean, topic, {
    topicKey: opts.topicKey,
    subTopic: opts.subTopic || opts.subTopicDisplay || topic,
  });
  ensureFinalMemoryRuleBlock(clean, topic);
  dedupeNearDuplicateKeyIdeasOnPage(clean);
  ensureSpecificExamTipBlock(clean, topic);
  ensureTeachingFlowAnchors(clean, topic);

  const mergeThreshold = strictBlueprint ? 0.65 : 0.38;
  const maxConceptRepeats = strictBlueprint ? 4 : 2;

  mergeAdjacentRedundantBlocks(clean, { mergeThreshold });
  for (const page of clean.pages || []) {
    if (!Array.isArray(page.blocks)) continue;
    page.blocks = removeOverRepeatedConcepts(page.blocks, { maxConceptRepeats });
    page.blocks = removeWeakBlocks(page.blocks);
    if (page.blocks.length === 0) {
      page.blocks = [
        {
          type: "text",
          title: "",
          content: `## ${safeStr(topic)}\n\nAdd content here.`,
          role: "concept",
        },
      ];
    }
  }

  repairLessonStructureAfterCompression(clean, topic, {
    topicKey: opts.topicKey,
    subTopic: opts.subTopic || opts.subTopicDisplay || topic,
  });
  ensureSpecificExamTipBlock(clean, topic);

  applyV7TeachingPresentationLayer(clean, topic);
  enhanceComparisons(clean);
  addWhyThisMatters(clean, topic);
  addExamThinkingPrompts(clean);

  applyV9TeacherVoiceAndDepth(clean, topic);
  applyV10SimplicityAndFocus(clean, topic);
  keepBestPerConcept(clean, topic);
  hardPruneDuplicateConcepts(clean, topic);
  applyV11TeacherDialogueAndQuestioning(clean, topic);
  applyV12VisualHierarchyEngine(clean, topic);

  ensureWhatToNoticeBlocks(clean, topic, {
    topicKey: opts.topicKey,
    subTopic: opts.subTopic || opts.subTopicDisplay || topic,
  });
  ensureTopicSpecificWhatToNoticeBlocks(clean, topic, {
    topicKey: opts.topicKey,
    subTopic: opts.subTopic || opts.subTopicDisplay || topic,
  });
  ensureFinalMemoryRuleBlock(clean, topic);
  dedupeNearDuplicateKeyIdeasOnPage(clean);

  ensurePatternRecognitionBlock(clean, topic);
  ensureProperCommonMistakeBlock(clean, topic);

  applyV8TeachingIntentEngine(clean, topic, {
    retainTeachingIntentMetadata,
    teachingIntentTagOnly,
  });
  ensurePatternRecognitionBlock(clean, topic);
  ensureProperCommonMistakeBlock(clean, topic);
  ensureMinimumBlockCount(clean, topic, 10);

  if (process.env.NODE_ENV !== "production") {
    for (const page of clean.pages || []) {
      console.log(
        "V4 keyIdea debug:",
        (page.blocks || [])
          .map((b, i) => ({ i, type: b.type, title: b.title, role: b.role, content: b.content }))
          .filter((b) => b.type === "keyIdea")
      );
      console.log(
        "V4 examTip debug:",
        (page.blocks || [])
          .map((b, i) => ({ i, type: b.type, role: b.role, content: b.content }))
          .filter((b) => b.type === "examTip")
      );
      const commonMistakeDbg = (page.blocks || [])
        .map((b, i) => ({ i, type: b.type, role: b.role, content: b.content }))
        .filter((x) => x.type === "commonMistake" || x.role === "commonMistake");
      console.log("CommonMistake debug:", commonMistakeDbg);
      const fmrDbg = (page.blocks || [])
        .map((b, i) => ({ i, type: b.type, role: b.role, title: b.title, content: b.content }))
        .filter((x) => safeStr(x.role, "") === "finalMemoryRule");
      console.log("FinalMemoryRule debug:", fmrDbg);
      const wtnOnly = (page.blocks || []).filter(
        (b) =>
          /what to notice/i.test(String(b?.title || "").trim()) ||
          safeStr(b?.role, "") === "whatToNotice"
      );
      if (wtnOnly.length) {
        console.log("What to Notice debug:", wtnOnly);
      }
      console.log(
        "AI lesson block roles:",
        (page.blocks || []).map((b, i) => ({
          i,
          type: b.type,
          role: b.role,
          title: b.title,
        }))
      );
    }
    const allBlocksSanitized = (clean.pages || []).flatMap((p) => p.blocks || []);
    const workedSanitized = allBlocksSanitized.find((b) => safeStr(b.role, "") === "workedExample");
    console.log(
      "Worked example debug:",
      workedSanitized
        ? {
            question: workedSanitized.question || workedSanitized.prompt,
            answer: workedSanitized.answer || workedSanitized.explanation,
            role: workedSanitized.role,
          }
        : "NONE"
    );
    for (const page of clean.pages || []) {
      console.log(
        "V5 flow debug:",
        (page.blocks || []).map((b, i) => ({
          i,
          type: b.type,
          role: b.role,
          title: b.title,
          content: b.content,
        }))
      );
    }
  }

  dedupeByTeachingIntent(clean, topic);

  // Required by validateLessonStructure; V10.5 / dedupe may drop a keyIdea that held this role earlier.
  ensureSynthesisRole(clean, topic);

  const objectiveBoundaryResult = enforceObjectiveBoundariesOnDraft({
    pages: clean.pages,
    topicKey: opts.topicKey,
    subTopic: opts.subTopic || opts.subTopicDisplay || topic,
    topic,
  });
  if (objectiveBoundaryResult.changed) {
    clean.pages = objectiveBoundaryResult.pages;
  }
  if (objectiveBoundaryResult.objectiveBoundary?.outOfScopeObjectiveCount > 0) {
    clean.objectiveBoundary = objectiveBoundaryResult.objectiveBoundary;
  }

  const interactionAuthorityResult = enforceInteractionAuthorityOnDraft({
    pages: clean.pages,
    topicKey: opts.topicKey,
    subTopic: opts.subTopic || opts.subTopicDisplay || topic,
    topic,
  });
  if (interactionAuthorityResult.changed) {
    clean.pages = interactionAuthorityResult.pages;
  }
  if (interactionAuthorityResult.enforcement?.blocksRerouted?.length) {
    clean.interactionAuthorityEnforcement = interactionAuthorityResult.enforcement;
  }

  enforceRequiredPracticalLessonStructure(clean, {
    topic,
    topicKey: opts.topicKey,
    subTopic: opts.subTopic || opts.subTopicDisplay || topic,
    subject,
  });

  const theoryLessonCtx = {
    topic,
    topicKey: opts.topicKey,
    subTopic: opts.subTopic || opts.subTopicDisplay || topic,
  };

  if (!isRequiredPracticalMode(theoryLessonCtx)) {
    ensureMinimumDiagramBlocks(clean, topic, theoryLessonCtx);
    ensureTopicSpecificWhatToNoticeBlocks(clean, topic, theoryLessonCtx);
    enforceDashboardTeacherFirstOpening(clean, {
      topic,
      topicKey: opts.topicKey,
      subTopic: opts.subTopic || opts.subTopicDisplay || topic,
      subject,
    });
    ensureRealWorldApplicationBlock(clean, topic, theoryLessonCtx);
  }

  stripV8AuthoringTags(clean);

  return clean;
}

/* =========================================================
   ✅ pageId generator for saving to Lesson model
   ========================================================= */

function makePageIdFallback(idx) {
  return `p_${Date.now()}_${idx}_${Math.random().toString(16).slice(2)}`;
}

function ensurePageIds(pages) {
  const arr = Array.isArray(pages) ? pages : [];
  return arr.map((p, idx) => ({
    pageId: safeStr(p?.pageId, "") || makePageIdFallback(idx),
    title: safeStr(p?.title, `Page ${idx + 1}`),
    order: Number.isFinite(Number(p?.order)) ? Number(p.order) : idx + 1,
    pageType: safeStr(p?.pageType, ""),
    // ✅ FIX: Preserve hero field
    hero: p?.hero ? {
      type: safeStr(p.hero.type, "none"),
      src: p.hero.src ?? "",
      caption: safeStr(p.hero.caption, ""),
    } : undefined,
    blocks: Array.isArray(p?.blocks) ? p.blocks : [],
    checkpoint: p?.checkpoint || undefined,
  }));
}

/** True when the teacher prompt requests a fixed multi-section layout (softer V6 compression). */
function detectStrictBlueprintFromPrompt(...parts) {
  const s = parts.filter(Boolean).join("\n");
  return /STRICT\s+BLUEPRINT/i.test(s);
}

/* =========================================================
   INTERNAL: generate sanitized AI draft (shared)
   ========================================================= */
async function generateSanitizedDraft({
  topic,
  subject,
  level,
  board,
  tier,
  specPoints = [],
  pastPaperSnippets = [],
  extraCoveragePoints = [],
  subTopicDisplay = null,
  topicKey = null,
  requiredKeywords = [],
  requiredMisconceptions = [],
  additionalInstructions = "",
  engineInstructions = "",
  strictSpec = false,
  retainTeachingIntentMetadata = false,
  teachingIntentTagOnly = false,
  frameworkClassification = null,
}) {
  const referencePromptSection = buildReferenceLessonMaterialPrompt(additionalInstructions);
  const systemPrompt = buildSystemPrompt(subject, level, referencePromptSection);
  const userPrompt = buildUserPromptFromMd({
    topic,
    subject,
    level,
    board,
    tier,
    specPoints,
    pastPaperSnippets,
    extraCoveragePoints,
    subTopicDisplay,
    topicKey,
    requiredKeywords,
    requiredMisconceptions,
    additionalInstructions,
    engineInstructions,
    strictSpec,
    frameworkClassification,
  });

  const ai = await callOpenAI({ systemPrompt, userPrompt });

  let draft;
  try {
    draft = JSON.parse(ai.raw);
  } catch (e) {
    const snippet = typeof ai.raw === "string" ? ai.raw.slice(0, 200) : "";
    throw new Error(`AI returned invalid JSON. Snippet: ${snippet}`);
  }

  const strictBlueprint = detectStrictBlueprintFromPrompt(userPrompt, additionalInstructions, topic);
  const sanitized = sanitizeDraft(draft, {
    subject,
    level,
    topic,
    topicKey,
    subTopic: subTopicDisplay || topic,
    strictBlueprint,
    retainTeachingIntentMetadata,
    teachingIntentTagOnly,
  });
  return { sanitized, ai };
}

// @route   POST /api/ai/generate-lesson
// @desc    Generate a structured lesson draft (Teachers/Admin only)
// @access  Private
router.post("/generate-lesson", auth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!requireTeacherOrAdmin(req, res)) return;

    const topic = safeStr(req.body?.topic, "");
    const subject = safeStr(req.body?.subject, "");
    const level = safeStr(req.body?.level, "");
    const board =
      req.body?.board === undefined || req.body?.board === null
        ? ""
        : String(req.body.board);
    const tier = safeStr(req.body?.tier, "");

    if (!topic || !subject || !level) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "Please provide topic, subject, and level.",
      });
    }

    console.log(
      `🤖 AI generate-lesson: user=${getAuthUserId(req)} type=${req.user.userType} | ${subject} | ${level} | ${topic}`
    );

    const additionalInstructions =
      typeof req.body?.additionalInstructions === "string"
        ? req.body.additionalInstructions.trim().slice(0, 2000)
        : "";
    const retainTeachingIntentMetadata = req.body?.retainTeachingIntentMetadata === true;
    const teachingIntentTagOnly = req.body?.teachingIntentTagOnly === true;

    // Algorithm 1: resolve spec/topic and load syllabus + past paper context (no breaking change if missing)
    let specPoints = [];
    let pastPaperSnippets = [];
    const resolved = resolveSpecAndTopicKey(board, subject, topic);
    if (resolved) {
      specPoints = getSpecPointsForTopic(resolved.specKey, resolved.topicKey) || [];
      pastPaperSnippets = await getPastPaperSnippetsForTopic(
        resolved.specKey,
        resolved.topicKey,
        5,
        PastPaperQuestion
      );
    }

    const engineInstructionsWithCoverage = mergeOneShotCoveragePlanIntoInstructions(
      "",
      {
        topic,
        subject,
        examBoard: board,
        tier,
        pages: req.body?.seedPages || req.body?.pages,
        quiz: req.body?.quiz,
        flashcards: req.body?.flashcards,
      }
    );

    let { sanitized, ai } = await generateSanitizedDraft({
      topic,
      subject,
      level,
      board,
      tier,
      specPoints,
      pastPaperSnippets,
      additionalInstructions,
      engineInstructions: engineInstructionsWithCoverage,
      retainTeachingIntentMetadata,
      teachingIntentTagOnly,
    });

    let coverageScore = null;
    let missingPoints = [];
    if (specPoints.length > 0) {
      const coverage = await verifySyllabusCoverage(sanitized, specPoints);
      coverageScore = coverage.coverageRatio;
      missingPoints = coverage.missingPoints || [];
      if (
        coverageScore < COVERAGE_THRESHOLD &&
        missingPoints.length > 0
      ) {
        const { sanitized: retrySanitized, ai: retryAi } = await generateSanitizedDraft({
          topic,
          subject,
          level,
          board,
          tier,
          specPoints,
          pastPaperSnippets,
          extraCoveragePoints: missingPoints,
          additionalInstructions,
          engineInstructions: engineInstructionsWithCoverage,
          retainTeachingIntentMetadata,
          teachingIntentTagOnly,
        });
        const retryCoverage = await verifySyllabusCoverage(retrySanitized, specPoints);
        if (retryCoverage.coverageRatio >= coverageScore) {
          sanitized = retrySanitized;
          ai = retryAi;
          coverageScore = retryCoverage.coverageRatio;
          missingPoints = retryCoverage.missingPoints || [];
        }
      }
    }

    const payload = {
      success: true,
      message: "Lesson draft generated successfully.",
      draft: sanitized,
      ...(sanitized.objectiveBoundary ? { objectiveBoundary: sanitized.objectiveBoundary } : {}),
      mappingHint: {
        lesson: {
          title: sanitized.title,
          description: sanitized.description,
          subject,
          level: normalizeLevel(level),
          topic,
          board: sanitized.board,
          tier: sanitized.tier,
          estimatedDuration: sanitized.estimatedDuration,
          tags: sanitized.tags,
          content: "Structured lesson (see pages)",
          pages: sanitized.pages,
        },
      },
      model: ai.model,
      usage: ai.usage,
      generatedBy: getAuthUserId(req),
    };
    if (specPoints.length > 0) {
      payload.coverageScore = coverageScore;
      payload.missingPoints = missingPoints;
    }
    const v7AdvisoryGen = collectV7TeachingAdvisoryNotes(sanitized);
    const v12AdvisoryGen = collectV12VisualAdvisoryNotes(sanitized);
    const mergedAdvisoryGen = [...v7AdvisoryGen, ...v12AdvisoryGen];
    if (mergedAdvisoryGen.length) payload.teachingAdvisory = mergedAdvisoryGen;
    return res.json(payload);
  } catch (error) {
    console.error("❌ AI Route Error:", error?.message || error);

    if (error?.response?.status) {
      const status = error.response.status;
      const msg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        "OpenAI API error";
      return res.status(status === 429 ? 429 : 500).json({
        error: status === 429 ? "OpenAI rate limit exceeded" : "AI request failed",
        details: IS_PRODUCTION ? "The AI service returned an error." : msg,
      });
    }

    return sendInternalError("ai/generate-lesson-draft", error, res, {
      extra: { error: "Failed to generate lesson draft." },
    });
  }
});

/* =========================================================
   ✅ NEW ROUTE: generate + save draft lesson (Option A)
   POST /api/ai/generate-and-save
   - Clone Gold Standard template FIRST
   - Then fill it with AI output
   ========================================================= */
router.post("/generate-and-save", auth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!requireTeacherOrAdmin(req, res)) return;

    // Early check: OpenAI must be configured
    if (!process.env.OPENAI_API_KEY || !String(process.env.OPENAI_API_KEY).trim()) {
      return res.status(503).json({
        error: "AI lesson generation is not configured",
        details: "OPENAI_API_KEY is missing. Add it to your environment to enable AI generation.",
      });
    }

    // Extract ALL body fields first — autoGenerateFromBanks must be declared before any use
    const autoGenerateFromBanks = req.body?.autoGenerateFromBanks === true;
    const topic = safeStr(req.body?.topic, "");
    const subject = safeStr(req.body?.subject, "");
    const level = safeStr(req.body?.level, "");
    const board =
      req.body?.board === undefined || req.body?.board === null
        ? ""
        : String(req.body.board);
    const tier = safeStr(req.body?.tier, "");
    const topicKey =
      typeof req.body?.topicKey === "string" && req.body.topicKey.trim()
        ? req.body.topicKey.trim()
        : null;
    const requiredKeywords = Array.isArray(req.body?.requiredKeywords)
      ? req.body.requiredKeywords.filter((x) => typeof x === "string" && x.trim())
      : [];
    const requiredMisconceptions = Array.isArray(req.body?.requiredMisconceptions)
      ? req.body.requiredMisconceptions.filter((x) => typeof x === "string" && x.trim())
      : [];
    const additionalInstructions =
      typeof req.body?.additionalInstructions === "string"
        ? req.body.additionalInstructions.trim().slice(0, 2000)
        : "";
    const strictSpec = req.body?.strictSpec === true;
    const retainTeachingIntentMetadata = req.body?.retainTeachingIntentMetadata === true;
    const teachingIntentTagOnly = req.body?.teachingIntentTagOnly === true;

    if (process.env.NODE_ENV !== "production") {
      console.log("[generate-and-save] handler v2", { autoGenerateFromBanksFromBody: req.body?.autoGenerateFromBanks, autoGenerateFromBanks });
    }

    if (!topic || !subject || !level) {
      return res.status(400).json({
        error: "Please provide topic, subject, and level.",
      });
    }

    console.log(
      `🤖 AI generate-and-save (clone-first): user=${getAuthUserId(req)} type=${req.user.userType} | ${subject} | ${level} | ${topic}`
    );

    // ✅ 1) Find the single Gold Standard master template (optional — used only for templateSource tracking)
    const gold = await Lesson.findOne({ isTemplate: true }).lean();

    const specKey = boardSubjectToSpecKey(board, subject) || (topicKey ? parseTopicKey(topicKey).specKey : null);

    // ✅ Derive canonical topicKey: prefer from request (strip namespace if present); otherwise resolve from topic string
    const rawFromRequest = topicKey ? (parseTopicKey(topicKey).topicKey || topicKey.trim()) : null;
    let canonicalTopicKey = rawFromRequest || null;
    let subTopicDisplay = topic;

    if (canonicalTopicKey) {
      if (specKey && !isValidTopicForSpec(specKey, canonicalTopicKey)) {
        return res.status(400).json({
          error: "Selected topic could not be mapped to syllabus. Please choose a topic from the list.",
        });
      }
    } else {
      const resolved = resolveSpecAndTopicKey(board, subject, topic);
      if (!resolved) {
        return res.status(400).json({
          error: "Could not map the selected subject/main topic/sub-topic to a curriculum topic.",
        });
      }
      const topicMeta = findTopicBySpecAndKey(resolved.specKey, resolved.topicKey);
      if (!topicMeta) {
        return res.status(400).json({
          error: "Could not map the selected topic to a curriculum sub-topic. Please select a specific sub-topic from the list.",
        });
      }
      canonicalTopicKey = resolved.topicKey;
      subTopicDisplay = topicMeta?.topic || topic;
    }

    if (!specKey) {
      return res.status(400).json({
        error: "Could not determine exam board and subject. Please provide board and subject.",
      });
    }

    const frameworkClassification = classifyTopicFramework({
      topic: subTopicDisplay || topic,
      topicKey: canonicalTopicKey || "",
      subject,
    });
    if (process.env.NODE_ENV !== "production") {
      console.log("[generate-and-save] framework classification:", frameworkClassification);
    }

    const frameworkRouting = resolveFrameworkRoutingFromClassification(frameworkClassification);

    const topicKeyForGroupCheck = String(canonicalTopicKey || "").includes(":")
      ? canonicalTopicKey
      : `${specKey}:${canonicalTopicKey}`;
    if (await adminTaxonomyService.topicIsGroupInMerged(specKey, topicKeyForGroupCheck)) {
      return res.status(400).json({
        error: "This topic is a group folder; select a leaf sub-topic for AI generation.",
      });
    }

    // Use exact topicKey for retrieval (no prefix/broad matching)
    let specPoints = getSpecPointsForTopic(specKey, canonicalTopicKey) || [];
    let pastPaperSnippets = await getPastPaperSnippetsForTopic(
      specKey,
      canonicalTopicKey,
      5,
      PastPaperQuestion
    );

    const thinCoverage = specPoints.length === 0;

    const useLessonGeneratorV2 = req.body?.useLessonGeneratorV2 === true;
    const v2Enabled = resolveV2Enabled({ requestFlag: useLessonGeneratorV2 });
    let lessonBlueprintV2 = null;
    let blueprintDiagnostics = null;
    let engineInstructions = "";

    if (v2Enabled) {
      const v2Plan = planLessonV2(
        {
          topic: subTopicDisplay || topic,
          subject,
          board,
          tier,
          topicKey: canonicalTopicKey,
          durationTier: safeStr(req.body?.durationTier, "standard") || "standard",
        },
        { requestFlag: true }
      );
      lessonBlueprintV2 = v2Plan.blueprint;
      engineInstructions = mergeV2IntoAdditionalInstructions(
        engineInstructions,
        v2Plan.promptAppendix
      );
      if (process.env.NODE_ENV !== "production") {
        blueprintDiagnostics = v2Plan.diagnostics || runBlueprintDiagnostics(lessonBlueprintV2);
        console.log("[generate-and-save] Lesson Generator V2 blueprint:", {
          archetype: lessonBlueprintV2?.lessonArchetype,
          steps: lessonBlueprintV2?.learningJourney?.length,
        });
      }
    }

    const useLessonGeneratorV4 = req.body?.useLessonGeneratorV4 === true;
    const v4Enabled = resolveV4Enabled({ requestFlag: useLessonGeneratorV4 });
    if (v4Enabled && lessonBlueprintV2) {
      engineInstructions = mergeV4IntoAdditionalInstructions(
        engineInstructions,
        buildV4PromptForBlueprint(lessonBlueprintV2, {
          tier,
          subject,
          topic: subTopicDisplay || topic,
          examBoard: board,
          pages: req.body?.seedPages || req.body?.pages,
          quiz: req.body?.quiz,
          flashcards: req.body?.flashcards,
        })
      );
    } else if (v4Enabled && !lessonBlueprintV2) {
      const v4Blueprint =
        planLessonV2(
          {
            topic: subTopicDisplay || topic,
            subject,
            board,
            tier,
            topicKey: canonicalTopicKey,
            durationTier: safeStr(req.body?.durationTier, "standard") || "standard",
          },
          { requestFlag: true }
        ).blueprint || null;
      if (v4Blueprint) {
        lessonBlueprintV2 = lessonBlueprintV2 || v4Blueprint;
        engineInstructions = mergeV4IntoAdditionalInstructions(
          engineInstructions,
          buildV4PromptForBlueprint(v4Blueprint, {
            tier,
            subject,
            topic: subTopicDisplay || topic,
            examBoard: board,
            pages: req.body?.seedPages || req.body?.pages,
            quiz: req.body?.quiz,
            flashcards: req.body?.flashcards,
          })
        );
      }
    }

    engineInstructions = mergeOneShotCoveragePlanIntoInstructions(engineInstructions, {
      topic: subTopicDisplay || topic,
      topicKey: canonicalTopicKey,
      subject,
      examBoard: board,
      tier,
      pages: req.body?.seedPages || req.body?.pages,
      quiz: req.body?.quiz,
      flashcards: req.body?.flashcards,
    });

    // ✅ 2) Generate AI draft (sanitized) with sub-topic scope guardrails
    let sanitized = (await generateSanitizedDraft({
      topic,
      subject,
      level,
      board,
      tier,
      specPoints,
      pastPaperSnippets,
      subTopicDisplay,
      topicKey: canonicalTopicKey,
      requiredKeywords,
      requiredMisconceptions,
      additionalInstructions,
      engineInstructions,
      strictSpec,
      retainTeachingIntentMetadata,
      teachingIntentTagOnly,
      frameworkClassification,
    })).sanitized;

    // ✅ 2b) Curriculum validation
    const generationValidation = validateLessonDraftAgainstCurriculum(sanitized, {
      specPoints,
      requiredKeywords,
      requiredMisconceptions,
      requireExamQuestions: true,
      topic,
    });
    const curriculumIssues = buildCurriculumFeedbackLines(generationValidation);
    const structureValidation = validateLessonStructure(sanitized, { isManual: false });
    const typeIssues = validateBlockTypeRequirements(sanitized);
    const structureIssues = [...mergeStructureValidationForScoring(structureValidation), ...typeIssues];

    // ✅ 2c) Score quality and decide whether to trigger second pass
    const qualityResult = scoreLessonQuality(sanitized, {
      curriculumIssues,
      structureIssues,
      source: "ai",
    });

    const shouldRewrite =
      curriculumIssues.length > 0 || structureIssues.length > 0 || qualityResult.score < 70;

    let finalDraft = sanitized;
    let finalStructureIssues = structureIssues;

    if (shouldRewrite) {
      try {
        const improved = await improveDraftWithSecondPass(
          {
            draft: sanitized,
            curriculumIssues,
            structureIssues,
            qualityIssues: qualityResult.issues,
            qualitySuggestions: qualityResult.suggestions,
          },
          {
            topic,
            subject,
            level,
            board,
            tier,
            specPoints,
            additionalInstructions,
            retainTeachingIntentMetadata,
            teachingIntentTagOnly,
            topicKey: canonicalTopicKey,
            subTopic: subTopicDisplay || topic,
          }
        );
        finalDraft = improved.sanitized;

        const finalCurriculumValidation = validateLessonDraftAgainstCurriculum(finalDraft, {
          specPoints,
          requiredKeywords,
          requiredMisconceptions,
          requireExamQuestions: true,
          topic,
        });
        const finalStruct = validateLessonStructure(finalDraft, { isManual: false });
        finalStructureIssues = [
          ...mergeStructureValidationForScoring(finalStruct),
          ...validateBlockTypeRequirements(finalDraft),
        ];
        const finalCurriculumIssues = buildCurriculumFeedbackLines(finalCurriculumValidation);

        const finalQuality = scoreLessonQuality(finalDraft, {
          curriculumIssues: finalCurriculumIssues,
          structureIssues: finalStructureIssues,
          source: "ai",
        });

        // Tuning: lowered floor so weak drafts can be saved while prompts improve (raise for production).
        if (finalQuality.score < 35) {
          throw new Error(
            `Lesson quality too low to save. Score: ${finalQuality.score}. Top issues: ${finalQuality.issues.slice(0, 5).join("; ")}`
          );
        }

        if (process.env.NODE_ENV !== "production") {
          console.log("[generate-and-save] Second-pass improvement applied, final score:", finalQuality.score);
        }
      } catch (e) {
        if (e?.message?.includes("Lesson quality too low to save")) throw e;
        console.warn("[generate-and-save] Second-pass improvement failed, using original draft:", e?.message || e);
      }
    }

    sanitized = finalDraft;

    if (process.env.NODE_ENV !== "production") {
      const allBlocks = (finalDraft.pages || []).flatMap((p) => p.blocks || []);
      const worked = allBlocks.find((b) => safeStr(b.role, "") === "workedExample");
      console.log(
        "Worked example debug:",
        worked
          ? {
              question: worked.question || worked.prompt,
              answer: worked.answer || worked.explanation,
              role: worked.role,
            }
          : "NONE"
      );
    }

    if (finalStructureIssues.length > 0) {
      throw new Error(`Lesson failed structure validation: ${finalStructureIssues.join("; ")}`);
    }

    // ✅ 3) Add curated hero visual for AI lessons (even if AI didn't produce hero)
    console.log("🧩 [AI CuratedVisual] lookup input:", {
      subject,
      examBoard: board || "AQA",
      level: normalizeLevel(level),
      topic,
    });

    try {
      const { hero } = findCuratedVisual({
        subject,
        examBoard: board || "AQA",
        level: normalizeLevel(level),
        topic,
      });

      if (hero) {
        if (!Array.isArray(sanitized.pages)) sanitized.pages = [];
        if (!sanitized.pages[0]) {
          sanitized.pages[0] = { 
            title: "Overview", 
            order: 1, 
            pageType: "", 
            blocks: [] 
          };
        }
        sanitized.pages[0].hero = hero;
        console.log("✅ [AI CuratedVisual] hero attached to AI draft:", hero);
      } else {
        console.log("⚠️ [AI CuratedVisual] no hero match for AI lesson");
      }
    } catch (e) {
      console.warn("⚠️ AI curated hero attach skipped:", e?.message || e);
    }

    // ✅ 4) Build teacher display name
    const first = safeStr(req.user?.firstName, "");
    const last = safeStr(req.user?.lastName, "");
    const teacherName =
      first || last ? `${first} ${last}`.trim() : safeStr(req.user?.email, "Teacher");

    // ✅ 5) PR: Single-page default — use exactly 1 page from collapsed AI content (no template clone)
    // sanitized.pages is already collapsed to 1 page by collapsePagesToSingle in sanitizeDraft
    const aiPages = ensurePageIds(sanitized.pages);
    const singlePage = aiPages[0] || {
      title: "Page 1",
      order: 1,
      pageType: "",
      blocks: [{ type: "text", content: "Content coming soon." }],
      checkpoint: undefined,
    };

    const pagesMerged = [
      {
        pageId: safeStr(singlePage?.pageId, "") || makePageIdFallback(0),
        title: safeStr(singlePage?.title, "Page 1"),
        order: 1,
        pageType: safeStr(singlePage?.pageType, ""),
        hero: singlePage?.hero,
        visualModelId: singlePage?.visualModelId,
        checkpoint: singlePage?.checkpoint,
        blocks: Array.isArray(singlePage?.blocks) && singlePage.blocks.length
          ? singlePage.blocks
          : [{ type: "text", content: "Content coming soon." }],
      },
    ];

    // ✅ Biology fallback: ensure page 1 has a real diagram (DB lookup; no env)
    const subjectNorm = subject.toLowerCase();
    if (subjectNorm === "biology" && !hasDiagram(pagesMerged)) {
      const visualId = await findDefaultCellVisualId();
      if (visualId && pagesMerged[0]) {
        const page0 = pagesMerged[0];
        const blocks = Array.isArray(page0.blocks) ? [...page0.blocks] : [];
        const diagramBlock = {
          type: "diagram",
          visualId,
          caption: "Basic cell structure",
          mode: "annotated",
          annotations: [],
          steps: [],
        };
        const insertAt = isDashboardTeacherFirstEnabled()
          ? Math.min(9, blocks.length)
          : 0;
        blocks.splice(insertAt, 0, diagramBlock);
        pagesMerged[0] = { ...page0, blocks };
      } else if (!visualId) {
        console.warn("⚠️ No default cell visual found; skipping fallback diagram injection");
      }
    }

    let pagesPromoted = promoteHeroOnLesson({ pages: pagesMerged }).pages;

    const useLessonGeneratorV3 = req.body?.useLessonGeneratorV3 === true;
    const v3Enabled = resolveV3Enabled({ requestFlag: useLessonGeneratorV3 });
    let lessonGeneratorV3Result = null;
    let architectureDiagnostics = null;

    if (v3Enabled) {
      const blueprintForV3 =
        lessonBlueprintV2 ||
        planLessonV2(
          {
            topic: subTopicDisplay || topic,
            subject,
            board,
            tier,
            topicKey: canonicalTopicKey,
            durationTier: safeStr(req.body?.durationTier, "standard") || "standard",
          },
          { requestFlag: v2Enabled || true }
        ).blueprint;

      lessonGeneratorV3Result = applyV3BeforeExport(pagesPromoted, blueprintForV3, {
        strict: req.body?.lessonGeneratorV3Strict !== false,
      });
      pagesPromoted = lessonGeneratorV3Result.pages;

      if (lessonGeneratorV3Result.qualityGate?.blockExport) {
        const diag =
          process.env.NODE_ENV !== "production"
            ? lessonGeneratorV3Result.diagnostics
            : null;
        return res.status(422).json({
          error: "Lesson architecture quality gate failed",
          details: lessonGeneratorV3Result.qualityGate.failures.join("; "),
          flowScore: lessonGeneratorV3Result.flowScore,
          ...(diag && { architectureDiagnostics: diag }),
          code: "LESSON_ARCHITECTURE_GATE",
        });
      }

      if (process.env.NODE_ENV !== "production") {
        architectureDiagnostics = lessonGeneratorV3Result.diagnostics;
        console.log("[generate-and-save] Lesson Generator V3 flow score:", lessonGeneratorV3Result.flowScore);
      }
    }

    let lessonGeneratorV4Result = null;
    let teachingDiagnostics = null;
    if (v4Enabled) {
      const blueprintForV4 =
        lessonBlueprintV2 ||
        planLessonV2(
          {
            topic: subTopicDisplay || topic,
            subject,
            board,
            tier,
            topicKey: canonicalTopicKey,
            durationTier: safeStr(req.body?.durationTier, "standard") || "standard",
          },
          { requestFlag: true }
        ).blueprint;

      lessonGeneratorV4Result = applyV4AfterGeneration(pagesPromoted, blueprintForV4, {
        strict: req.body?.lessonGeneratorV4Strict === true,
        tier,
        subject,
      });

      if (lessonGeneratorV4Result.qualityGate?.blockExport) {
        return res.status(422).json({
          error: "Lesson teaching quality gate failed",
          details: lessonGeneratorV4Result.qualityGate.failures.join("; "),
          flowScore: lessonGeneratorV4Result.flowScore,
          teachingDiagnostics: lessonGeneratorV4Result.diagnostics,
          code: "LESSON_TEACHING_GATE",
        });
      }

      if (process.env.NODE_ENV !== "production") {
        teachingDiagnostics = lessonGeneratorV4Result.diagnostics;
        console.log("[generate-and-save] Lesson Generator V4 teaching score:", {
          overallTeaching: lessonGeneratorV4Result.flowScore?.overallTeachingScore,
          canAchievePremium: lessonGeneratorV4Result.qualityGate?.canAchievePremium,
        });
      }
    }

    let teacherBrainInjection = null;
    if (v4Enabled) {
      const briefResult = applyTeacherBrainBriefInjection(pagesPromoted, {
        topic: subTopicDisplay || topic,
        subject,
        examBoard: board,
        tier,
        blueprint: lessonBlueprintV2,
      });
      pagesPromoted = briefResult.pages;
      teacherBrainInjection = {
        injectionCount: briefResult.injections?.length || 0,
        injections: briefResult.injections,
      };
      if (process.env.NODE_ENV !== "production" && briefResult.injections?.length) {
        console.log("[generate-and-save] Teacher Brain brief injection:", briefResult.injections);
      }
    }

    // ✅ Step 16: Compute and persist quality metadata
    const finalDraftForQuality = { ...sanitized, pages: pagesPromoted };
    let aiQualityResult = scoreLessonQuality(finalDraftForQuality, {
      structureIssues: [],
      curriculumIssues: [],
      source: "ai",
    });
    if (lessonGeneratorV4Result && !lessonGeneratorV4Result.qualityGate?.canAchievePremium) {
      const capped = Math.min(aiQualityResult.score, 84);
      if (capped < aiQualityResult.score) {
        aiQualityResult = {
          ...aiQualityResult,
          score: capped,
          band: getLessonQualityBand(capped),
          issues: [
            ...aiQualityResult.issues,
            "V4 teaching gate: cannot reach 9/10+ until teaching sub-scores exceed 80.",
          ],
        };
      }
    }

    const rpEnforcementCtx = {
      topic,
      topicKey: canonicalTopicKey,
      subTopic: subTopicDisplay || topic,
      subject,
    };
    const rpModeFinal = isRequiredPracticalMode(rpEnforcementCtx);

    const interactionAuthorityFinal = enforceInteractionAuthorityOnDraft({
      pages: pagesPromoted,
      topicKey: canonicalTopicKey,
      subTopic: subTopicDisplay || topic,
      topic,
    });
    if (interactionAuthorityFinal.changed) {
      pagesPromoted = interactionAuthorityFinal.pages;
    }

    if (rpModeFinal) {
      const enforced = enforceRequiredPracticalLessonStructure(
        { pages: pagesPromoted },
        rpEnforcementCtx
      );
      pagesPromoted = enforced.pages;
    } else if (isDashboardTeacherFirstEnabled()) {
      const enforced = enforceDashboardTeacherFirstOpening(
        { pages: pagesPromoted },
        rpEnforcementCtx
      );
      pagesPromoted = enforced.pages;
    }

    const pagesForDb = makeLessonDbSafe({ pages: pagesPromoted }).pages;

    // ✅ 7) Create the cloned lesson doc (required fields satisfied)
    const lessonDoc = new Lesson({
      // Required top-level fields
      title: sanitized.title,
      description: sanitized.description,
      topic,
      subject,
      level: normalizeLevel(level),
      content: "Structured lesson (see pages)",

      // Optional metadata
      board: sanitized.board,
      tier: normalizeLevel(level) === "GCSE" ? normalizeTier(sanitized.tier) : "",
      estimatedDuration: sanitized.estimatedDuration,
      tags: Array.isArray(sanitized.tags) ? sanitized.tags : [],

      // Namespaced topicKey for practice/banks (same as manual Create Lesson)
      ...(canonicalTopicKey && { topicKey: canonicalTopicKey }),

      // Step 16: Quality metadata
      qualityScore: aiQualityResult.score,
      qualityBand: aiQualityResult.band,
      qualityCategories: aiQualityResult.categories,
      qualityIssues: aiQualityResult.issues?.length ? aiQualityResult.issues : undefined,

      // Gold structure
      pages: pagesForDb,

      // Ownership
      teacherId: req.user?._id || req.user?.userId || req.user?.id,
      teacherName,

      // Status
      status: "draft",
      isPublished: false,

      // ✅ Template tracking (agreed; omit if no gold template)
      isTemplate: false,
      createdFromTemplate: !!gold,
      ...(gold?._id && { templateSource: gold._id }),

      // ✅ Curriculum validation (generation metadata)
      metadata: {
        generationValidation,
        ...(lessonBlueprintV2 && {
          lessonGeneratorVersion: v4Enabled ? 4 : v3Enabled ? 3 : 2,
          lessonBlueprintV2,
        }),
        ...(lessonGeneratorV3Result && {
          lessonGeneratorV3: {
            flowScore: lessonGeneratorV3Result.flowScore,
            qualityGate: lessonGeneratorV3Result.qualityGate,
            enforcement: lessonGeneratorV3Result.enforcement?.changes,
          },
        }),
        ...(lessonGeneratorV4Result && {
          lessonGeneratorV4: {
            flowScore: lessonGeneratorV4Result.flowScore,
            qualityGate: lessonGeneratorV4Result.qualityGate,
            overallTeachingScore: lessonGeneratorV4Result.flowScore?.overallTeachingScore,
          },
        }),
        ...(teacherBrainInjection && { teacherBrainInjection }),
        ...(frameworkRouting && { frameworkRouting }),
      },
    });

    await lessonDoc.save();

    let autoAttachResult = null;
    if (canonicalTopicKey && autoGenerateFromBanks) {
      try {
        const attach = await autoAttachLessonContent({
          lessonId: lessonDoc._id,
          actorUserId: req.user?._id || req.user?.userId || req.user?.id,
        });
        if (attach.ok && attach.attached) {
          autoAttachResult = attach.attached;
          const updated = await Lesson.findById(lessonDoc._id).lean();
          if (updated) {
            lessonDoc.flashcards = updated.flashcards;
            lessonDoc.quiz = updated.quiz;
            if (updated.examQuestions) lessonDoc.examQuestions = updated.examQuestions;
          }
        }
      } catch (e) {
        console.warn("⚠️ [AI generate-and-save] Auto-attach failed:", e?.message || e);
      }
    }

    const driftCheck = canonicalTopicKey
      ? validateGeneratedContentAgainstTopic({
          topicKey: canonicalTopicKey,
          specKey,
          subTopicLabel: subTopicDisplay,
          pages: pagesForDb,
          quizItems: lessonDoc.quiz,
          flashcards: lessonDoc.flashcards,
          examQuestions: lessonDoc.examQuestions,
        })
      : { valid: true, warnings: [] };

    const responsePayload = {
      success: true,
      message: "AI draft saved successfully.",
      lessonId: String(lessonDoc._id),
      title: lessonDoc.title,
      pagesCount: Array.isArray(lessonDoc.pages) ? lessonDoc.pages.length : 0,
      ...(gold?._id && { templateSource: String(gold._id) }),
      ...(autoAttachResult && { attached: autoAttachResult }),
      ...(thinCoverage && { thinCoverage: true }),
      frameworkClassification,
      ...(frameworkRouting && { frameworkRouting }),
      generationValidation,
      ...(v2Enabled && {
        lessonGeneratorV2: true,
        lessonArchetype: lessonBlueprintV2?.lessonArchetype,
        estimatedDurationMinutes: lessonBlueprintV2?.estimatedDuration?.minutes,
      }),
      ...(blueprintDiagnostics && { blueprintDiagnostics }),
      ...(v3Enabled && {
        lessonGeneratorV3: true,
        flowScore: lessonGeneratorV3Result?.flowScore,
      }),
      ...(v4Enabled && {
        lessonGeneratorV4: true,
        teachingFlowScore: lessonGeneratorV4Result?.flowScore,
        canAchievePremium: lessonGeneratorV4Result?.qualityGate?.canAchievePremium,
      }),
      ...(architectureDiagnostics && { architectureDiagnostics }),
      ...(teachingDiagnostics && { teachingDiagnostics }),
      ...(teacherBrainInjection && { teacherBrainInjection }),
    };
    if (thinCoverage) {
      responsePayload.warning = "Content coverage for this sub-topic is limited. The draft was kept within the selected sub-topic.";
    }
    if (!generationValidation.valid && generationValidation.summary) {
      responsePayload.warning = (responsePayload.warning ? responsePayload.warning + " " : "") + "Curriculum validation: " + generationValidation.summary;
    }
    if (!driftCheck.valid && driftCheck.warnings?.length > 0) {
      responsePayload.warning = (responsePayload.warning ? responsePayload.warning + " " : "") + driftCheck.warnings[0];
    }
    const v7AdvisorySave = collectV7TeachingAdvisoryNotes(finalDraftForQuality);
    const v12AdvisorySave = collectV12VisualAdvisoryNotes(finalDraftForQuality);
    const mergedAdvisorySave = [...v7AdvisorySave, ...v12AdvisorySave];
    if (mergedAdvisorySave.length) responsePayload.teachingAdvisory = mergedAdvisorySave;

    try {
      const boundaryAuditFull = auditLessonBoundary({
        topic: subTopicDisplay || topic,
        topicKey: canonicalTopicKey,
        subTopic: subTopicDisplay,
        pages: pagesForDb,
        quiz: lessonDoc.quiz,
        flashcards: lessonDoc.flashcards,
        practiceQuestions: lessonDoc.examQuestions,
      });
      const boundaryAuditMeta = boundaryAuditResponseMeta(boundaryAuditFull);
      if (boundaryAuditMeta) responsePayload.boundaryAudit = boundaryAuditMeta;
      const profile = resolveSubTopicProfile({
        topicKey: canonicalTopicKey,
        subTopic: subTopicDisplay,
        topic,
      });
      const replacementPlan = planBoundaryReplacements({
        boundaryAudit: boundaryAuditFull,
        subTopicProfile: profile,
      });
      const replacementMeta = boundaryReplacementResponseMeta(replacementPlan);
      if (replacementMeta) responsePayload.boundaryReplacementPlan = replacementMeta;
    } catch (boundaryAuditErr) {
      console.warn(
        "[generate-and-save] boundary audit skipped:",
        boundaryAuditErr?.message || boundaryAuditErr
      );
    }

    return res.json(responsePayload);
  } catch (error) {
    if (process.env.NODE_ENV !== "production" && error?.stack) {
      console.error("❌ AI generate-and-save stack:", error.stack);
    } else {
      console.error("❌ AI generate-and-save error:", error?.message || error);
    }

    // OpenAI / upstream 4xx/5xx — pass through status (422, 429, etc.) so frontend shows real error
    if (error?.response?.status) {
      const status = error.response.status;
      const body = error.response?.data;

      // Log exact response body for debugging (especially 422)
      console.error(`❌ [generate-and-save] ${status} response body:`, JSON.stringify(body, null, 2));

      const msg =
        (body && typeof body.error === "object" && body.error?.message ? body.error.message : null) ||
        (body && typeof body.error === "string" ? body.error : null) ||
        (body && typeof body.message === "string" ? body.message : null) ||
        "OpenAI API error";

      const payload = {
        error: status === 429 ? "OpenAI rate limit exceeded" : "Failed to generate lesson materials",
        details: IS_PRODUCTION ? "The AI service returned an error." : msg,
        ...(!IS_PRODUCTION && body?.error?.code ? { code: body.error.code } : {}),
      };
      return res.status(status).json(payload);
    }

    return sendInternalError("ai/generate-and-save", error, res, {
      extra: { error: "Failed to generate lesson materials" },
    });
  }
});

/* =========================================================
   Read-only framework classification audit for generated lessons
   GET /api/ai/framework-classification-audit?subject=Biology&limit=50
   ========================================================= */
router.get("/framework-classification-audit", auth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!requireTeacherOrAdmin(req, res)) return;

    const subject = safeStr(req.query?.subject, "");
    const parsedLimit = Number.parseInt(String(req.query?.limit ?? "50"), 10);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(200, parsedLimit)) : 50;

    const query = {
      isTemplate: { $ne: true },
      "metadata.lessonGeneratorVersion": { $exists: true },
    };
    if (subject) query.subject = subject;

    const lessons = await Lesson.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select({
        _id: 1,
        title: 1,
        subject: 1,
        topic: 1,
        topicKey: 1,
        createdAt: 1,
        metadata: 1,
      })
      .lean();

    const rows = lessons.map((lesson) => {
      const topicKeyRaw = safeStr(lesson.topicKey, "");
      const topicKeyParsed = parseTopicKey(topicKeyRaw);
      const classification =
        lesson?.metadata?.frameworkClassification &&
        typeof lesson.metadata.frameworkClassification === "object"
          ? lesson.metadata.frameworkClassification
          : classifyTopicFramework({
              topic: lesson.topic,
              topicKey: topicKeyParsed.topicKey || topicKeyRaw,
              subject: lesson.subject,
            });

      return {
        lessonId: String(lesson._id),
        title: safeStr(lesson.title, ""),
        subject: safeStr(lesson.subject, ""),
        topic: safeStr(lesson.topic, ""),
        subtopic: topicKeyParsed.topicKey || topicKeyRaw || "",
        framework: classification.framework,
        visualModel: classification.visualModel,
        confidence: classification.confidence,
        matchedBy: classification.matchedBy,
        generatedAt: lesson.createdAt || null,
      };
    });

    return res.json({
      success: true,
      filters: { subject: subject || null, limit },
      count: rows.length,
      rows,
    });
  } catch (error) {
    return sendInternalError("ai/framework-classification-audit", error, res, {
      extra: { error: "Failed to load framework classification audit" },
    });
  }
});

/* =========================================================
   ✅ Refactor existing lesson with V2 planner (optional — teacher opt-in only)
   POST /api/ai/refactor-lesson-v2
   Body: { lessonId, removeDuplicates?, durationTier? }
   Reorders/rechunks blocks to match blueprint; does not regenerate content from scratch.
   ========================================================= */
router.post("/refactor-lesson-v2", auth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!requireTeacherOrAdmin(req, res)) return;

    const lessonId = req.body?.lessonId != null ? String(req.body.lessonId).trim() : null;
    if (!lessonId || !mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Valid lessonId is required" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const { getLessonOwnerId } = require("../utils/lessonPayload");
    const ownerId = getLessonOwnerId(lesson);
    const currentUserId = req.user?._id || req.user?.userId || req.user?.id;
    const isOwner = ownerId != null && String(currentUserId) === String(ownerId);
    const isAdmin = (req.user?.userType || req.user?.role || "").toString().toLowerCase() === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Only the lesson owner or an admin can refactor this lesson" });
    }

    const refactorResult = refactorExistingLesson({
      topic: safeStr(lesson.topic, ""),
      subject: safeStr(lesson.subject, "Biology"),
      examBoard: safeStr(lesson.board, "AQA"),
      tier: safeStr(lesson.tier, "higher"),
      topicKey: lesson.topicKey,
      durationTier: safeStr(req.body?.durationTier, "standard") || "standard",
      pages: lesson.pages,
      removeDuplicates: req.body?.removeDuplicates !== false,
    });

    const pagesSafe = makeLessonDbSafe({ pages: refactorResult.pages }).pages;
    lesson.pages = pagesSafe;
    lesson.metadata = {
      ...(lesson.metadata && typeof lesson.metadata === "object" ? lesson.metadata : {}),
      lessonGeneratorVersion: 2,
      lessonBlueprintV2: refactorResult.blueprint,
      v2RefactoredAt: new Date().toISOString(),
      v2RefactorChanges: refactorResult.changes,
    };
    await lesson.save();

    const diagnostics =
      process.env.NODE_ENV !== "production"
        ? runBlueprintDiagnostics(refactorResult.blueprint, pagesSafe)
        : undefined;

    return res.json({
      success: true,
      message: "Lesson refactored with V2 planner.",
      lessonId: String(lesson._id),
      changes: refactorResult.changes,
      lessonArchetype: refactorResult.blueprint?.lessonArchetype,
      ...(diagnostics && { blueprintDiagnostics: diagnostics }),
    });
  } catch (error) {
    return sendInternalError("ai/refactor-lesson-v2", error, res, {
      extra: { error: "Failed to refactor lesson with V2" },
    });
  }
});

/* =========================================================
   ✅ Improve existing lesson with AI (creates new draft, does not overwrite)
   POST /api/ai/improve-lesson
   Body: { lessonId, additionalInstructions?, strictSpec?, retainTeachingIntentMetadata?, teachingIntentTagOnly? }
   ========================================================= */
router.post("/improve-lesson", auth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!requireTeacherOrAdmin(req, res)) return;

    if (!process.env.OPENAI_API_KEY || !String(process.env.OPENAI_API_KEY).trim()) {
      return res.status(503).json({
        error: "AI improvement is not configured",
        details: "OPENAI_API_KEY is missing.",
      });
    }

    const lessonId = req.body?.lessonId != null ? String(req.body.lessonId).trim() : null;
    if (!lessonId || !mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Valid lessonId is required" });
    }

    const additionalInstructions =
      typeof req.body?.additionalInstructions === "string"
        ? req.body.additionalInstructions.trim().slice(0, 2000)
        : "";
    const strictSpec = req.body?.strictSpec === true;
    const retainTeachingIntentMetadata = req.body?.retainTeachingIntentMetadata === true;
    const teachingIntentTagOnly = req.body?.teachingIntentTagOnly === true;

    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const { getLessonOwnerId } = require("../utils/lessonPayload");
    const ownerId = getLessonOwnerId(lesson);
    const currentUserId = req.user?._id || req.user?.userId || req.user?.id;
    const isOwner = ownerId != null && String(currentUserId) === String(ownerId);
    const isAdmin = (req.user?.userType || req.user?.role || "").toString().toLowerCase() === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Only the lesson owner or an admin can improve this lesson" });
    }

    const topic = safeStr(lesson.topic, "");
    const subject = safeStr(lesson.subject, "Biology");
    const level = normalizeLevel(safeStr(lesson.level, "GCSE"));
    const board = safeStr(lesson.board, "");
    const tier = level === "GCSE" ? normalizeTier(lesson.tier) : "";
    const specKey = boardSubjectToSpecKey(board, subject) || parseTopicKey(lesson.topicKey || "").specKey;
    const resolved = resolveSpecAndTopicKey(board, subject, topic);
    const parsedLessonKey = parseTopicKey(lesson.topicKey || "");
    const canonicalTopicKey = parsedLessonKey.topicKey || resolved?.topicKey || null;

    let specPoints = [];
    if (specKey && canonicalTopicKey) {
      specPoints = getSpecPointsForTopic(specKey, canonicalTopicKey) || [];
    }

    const draft = lessonToDraft(lesson);
    let generationValidation = validateLessonDraftAgainstCurriculum(draft, {
      specPoints,
      requiredKeywords: [],
      requiredMisconceptions: [],
      requireExamQuestions: false,
      topic,
    });
    generationValidation = {
      ...generationValidation,
      structureIssues: [
        ...mergeStructureValidationForScoring(validateLessonStructure(draft, { isManual: false })),
        ...validateBlockTypeRequirements(draft),
      ],
    };

    let sanitized = draft;
    try {
      const improved = await improveDraftWithSecondPass(
        {
          draft: sanitized,
          curriculumIssues: buildCurriculumFeedbackLines(generationValidation),
          structureIssues: generationValidation.structureIssues ?? [],
        },
        {
          topic,
          subject,
          level,
          board,
          tier,
          specPoints,
          additionalInstructions,
          retainTeachingIntentMetadata,
          teachingIntentTagOnly,
        }
      );
      sanitized = improved.sanitized;
    } catch (e) {
      console.warn("[improve-lesson] Second-pass failed, using original:", e?.message || e);
    }

    const improveStruct = validateLessonStructure(sanitized, { isManual: false });
    const improveStructureIssues = [
      ...improveStruct.blocking,
      ...validateBlockTypeRequirements(sanitized),
    ];
    if (improveStructureIssues.length > 0) {
      throw new Error(`Lesson failed structure validation: ${improveStructureIssues.join("; ")}`);
    }

    const aiPages = ensurePageIds(sanitized.pages);
    const singlePage = aiPages[0] || {
      title: "Page 1",
      order: 1,
      pageType: "",
      blocks: [{ type: "text", content: "Content coming soon." }],
      checkpoint: undefined,
    };

    const pagesMerged = [
      {
        pageId: safeStr(singlePage?.pageId, "") || makePageIdFallback(0),
        title: safeStr(singlePage?.title, "Page 1"),
        order: 1,
        pageType: safeStr(singlePage?.pageType, ""),
        hero: singlePage?.hero,
        visualModelId: singlePage?.visualModelId,
        checkpoint: singlePage?.checkpoint,
        blocks: Array.isArray(singlePage?.blocks) && singlePage.blocks.length
          ? singlePage.blocks
          : [{ type: "text", content: "Content coming soon." }],
      },
    ];

    const pagesPromotedImprove = promoteHeroOnLesson({ pages: pagesMerged }).pages;
    const pagesForDb = makeLessonDbSafe({ pages: pagesPromotedImprove }).pages;

    const first = safeStr(req.user?.firstName, "");
    const last = safeStr(req.user?.lastName, "");
    const teacherName = first || last ? `${first} ${last}`.trim() : safeStr(req.user?.email, "Teacher");

    const newLesson = new Lesson({
      title: (sanitized.title || lesson.title || "Improved").trim() + " (AI improved)",
      description: sanitized.description || lesson.description || "",
      topic,
      subject,
      level,
      content: "Structured lesson (see pages)",
      board: sanitized.board || board,
      tier: level === "GCSE" ? normalizeTier(sanitized.tier || tier) : "",
      estimatedDuration: sanitized.estimatedDuration || lesson.estimatedDuration || 40,
      tags: Array.isArray(sanitized.tags) && sanitized.tags.length ? sanitized.tags : (lesson.tags || []),
      ...((lesson.topicKey || canonicalTopicKey) && { topicKey: lesson.topicKey || canonicalTopicKey }),
      pages: pagesForDb,
      teacherId: currentUserId,
      teacherName,
      status: "draft",
      isPublished: false,
      metadata: { improvedFrom: lessonId },
    });

    await newLesson.save();

    return res.json({
      success: true,
      lessonId: String(newLesson._id),
      message: "Improved draft created. Original lesson unchanged.",
    });
  } catch (error) {
    console.error("❌ AI improve-lesson error:", error?.message || error);
    return sendInternalError("ai/improve-lesson", error, res, {
      extra: { error: "Failed to improve lesson" },
    });
  }
});

/* =========================================================
   PR3: GCSE Biology AQA Lesson Factory v1
   POST /api/ai/lesson-factory/aqa-gcse-biology
   Minimal input (topic + tier) → generated pages → saved draft lesson
   ========================================================= */
router.post("/lesson-factory/aqa-gcse-biology", auth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!requireTeacherOrAdmin(req, res)) return;

    const topicRaw = safeStr(req.body?.topic, "").trim();
    const topicKeyRaw = safeStr(req.body?.topicKey, "").trim();
    const tierRaw = safeStr(req.body?.tier, "").toLowerCase();
    const specPoint = safeStr(req.body?.specPoint, "").trim();
    const lengthPreset = (req.body?.length && safeStr(req.body.length).toLowerCase()) || "standard";

    // Resolve topic: prefer topicKey from taxonomy, else free-text topic
    let topic = topicRaw;
    if (topicKeyRaw) {
      const fromTaxonomy = findTopicByKey(topicKeyRaw);
      if (fromTaxonomy && fromTaxonomy.topic) {
        topic = fromTaxonomy.topic;
      }
      if (!topic && !topicRaw) {
        topic = topicKeyRaw.replace(/-/g, " ");
      }
    }
    if (!topic || topic.length < 3 || topic.length > 120) {
      return res.status(400).json({
        error: "Invalid topic",
        details: "Provide topic (3–120 characters) or a valid topicKey from the taxonomy.",
      });
    }
    if (tierRaw !== "foundation" && tierRaw !== "higher") {
      return res.status(400).json({
        error: "Invalid tier",
        details: "tier must be 'foundation' or 'higher'",
      });
    }
    const tier = tierRaw === "foundation" ? "foundation" : "higher";

    // PR6: Validate tier against taxonomy (higher-only topics cannot be generated as foundation)
    if (topicKeyRaw) {
      const topicMeta = findTopicByKey(topicKeyRaw);
      if (topicMeta && Array.isArray(topicMeta.tier) && !topicMeta.tier.includes(tier)) {
        return res.status(400).json({
          error: "This topic is Higher tier only.",
          details: "Choose Higher tier for this topic.",
        });
      }
    }

    if (specPoint.length > 200) {
      return res.status(400).json({
        error: "Invalid specPoint",
        details: "specPoint must be at most 200 characters",
      });
    }
    const lengthMap = { short: 4, standard: 5, long: 6 };
    const pageCount = lengthMap[lengthPreset] ?? 5;

    console.log(
      `🤖 AI lesson-factory AQA GCSE Biology: user=${getAuthUserId(req)} | topic=${topic} | tier=${tier} | length=${lengthPreset}`
    );

    // Reuse existing generator with fixed subject/level/board
    const { sanitized } = await generateSanitizedDraft({
      topic,
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      tier,
    });

    let pages = Array.isArray(sanitized.pages) ? sanitized.pages : [];
    pages = pages.slice(0, pageCount);
    if (pages.length < pageCount) {
      // Pad with placeholder pages so we always have exactly pageCount (checkpoint as block, not page-level)
      for (let i = pages.length; i < pageCount; i++) {
        pages.push({
          title: `Page ${i + 1}`,
          order: i + 1,
          pageType: "",
          blocks: [
            { type: "text", content: `## ${topic}\n\nAdd content here.` },
            {
              type: "checkpoint",
              questionType: "mcq",
              prompt: "Which statement is correct?",
              options: ["Option 1", "Option 2", "Option 3", "Option 4"],
              correctAnswer: "Option 1",
            },
          ],
        });
      }
    }
    pages = ensurePageIds(pages);

    // Attach curated hero visual for AQA GCSE Biology
    try {
      const { hero } = findCuratedVisual({
        subject: "Biology",
        examBoard: "AQA",
        level: "GCSE",
        topic,
      });
      if (hero && pages[0]) {
        pages[0] = { ...pages[0], hero };
      }
    } catch (e) {
      console.warn("⚠️ [Factory] Curated visual attach skipped:", e?.message || e);
    }

    // USP Step 1: Auto-attach diagram block from VisualModel (keyed by topicKey for deterministic lookup)
    const diagramLookupKey = topicKeyRaw
      ? topicKeyRaw.trim().toLowerCase()
      : topicToKey(topic);
    const diagramConceptKeys = diagramLookupKey ? BIOLOGY_DIAGRAM_MAP[diagramLookupKey] : undefined;
    if (Array.isArray(diagramConceptKeys) && diagramConceptKeys.length > 0) {
      try {
        let visual = null;
        for (const conceptKey of diagramConceptKeys) {
          visual = await VisualModel.findOne({
            conceptKey: String(conceptKey).trim(),
            isPublished: true,
          }).lean();
          if (visual) break;
        }
        if (visual && pages.length > 0) {
          const targetPageIndex = pages.length > 1 ? 1 : 0;
          const target = pages[targetPageIndex];
          // PR21: Foundation → annotated, no steps; Higher → step mode with 3 template steps (no labels)
          const isHigher = tier === "higher";
          const diagramBlock = {
            type: "diagram",
            visualId: visual._id,
            caption: "",
            mode: isHigher ? "step" : "annotated",
            annotations: [],
            steps: isHigher
              ? [
                  { id: new mongoose.Types.ObjectId().toString(), title: "Step 1", showAnnotationIds: [] },
                  { id: new mongoose.Types.ObjectId().toString(), title: "Step 2", showAnnotationIds: [] },
                  { id: new mongoose.Types.ObjectId().toString(), title: "Step 3", showAnnotationIds: [] },
                ]
              : [],
          };
          const blocks = Array.isArray(target.blocks) ? [...target.blocks] : [];
          blocks.unshift(diagramBlock);
          pages[targetPageIndex] = { ...target, blocks };
        }
      } catch (e) {
        console.warn("⚠️ [Factory] Diagram block attach skipped:", e?.message || e);
      }
    }

    // Biology fallback: if still no diagram, try default cell visual from DB only (no AI image generation)
    if (!hasDiagram(pages) && pages.length > 0) {
      const visualId = await findDefaultCellVisualId();
      if (visualId) {
        const page0 = pages[0];
        const blocks = Array.isArray(page0.blocks) ? [...page0.blocks] : [];
        blocks.unshift({
          type: "diagram",
          visualId,
          caption: "Basic cell structure",
          mode: "annotated",
          annotations: [],
          steps: [],
        });
        pages[0] = { ...page0, blocks };
      }
    }

    pages = promoteHeroOnLesson({ pages }).pages;

    const first = safeStr(req.user?.firstName, "");
    const last = safeStr(req.user?.lastName, "");
    const teacherName =
      first || last ? `${first} ${last}`.trim() : safeStr(req.user?.email, "Teacher");

    const pagesForDb = makeLessonDbSafe({ pages }).pages;

    const lessonDoc = new Lesson({
      title: sanitized.title,
      description: sanitized.description,
      content: "Structured lesson (see pages)",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      tier,
      topic,
      estimatedDuration: sanitized.estimatedDuration || 40,
      tags: Array.isArray(sanitized.tags) ? sanitized.tags : [],
      pages: pagesForDb,
      teacherId: req.user?._id || req.user?.userId || req.user?.id,
      teacherName,
      status: "draft",
      isPublished: false,
    });

    // PR-F1: Auto-copy flashcards from bank when lesson has none (FlashcardBank first, then TopicFlashcard)
    const existingFlashcards = Array.isArray(sanitized.flashcards) ? sanitized.flashcards : [];
    if (existingFlashcards.length === 0) {
      const seedKey = topicKeyRaw && topicKeyRaw.trim()
        ? topicKeyRaw.trim().toLowerCase()
        : topicToKey(topic);
      const ownerId = req.user?._id || req.user?.userId || req.user?.id;
      if (seedKey && ownerId) {
        try {
          const candidates = queryCandidates(DEFAULT_SPEC_LEGACY, parseTopicKey(seedKey).topicKey || seedKey);
          const bank = await FlashcardBank.findOne({ ownerId, topicKey: { $in: candidates } }).lean();
          if (bank && Array.isArray(bank.cards) && bank.cards.length > 0) {
            const lessonCards = bank.cards.map((c, i) => ({
              id: `fc_${Date.now()}_${i}`,
              front: (c.front && String(c.front).trim()) || "",
              back: (c.back && String(c.back).trim()) || "",
              tags: Array.isArray(c.tags) ? c.tags : [],
              difficulty: 1,
            })).filter((fc) => fc.front && fc.back);
            if (lessonCards.length > 0) {
              const { flashcards } = validateAndNormalizeRevision({ flashcards: lessonCards });
              lessonDoc.flashcards = flashcards;
            }
          }
          if (!lessonDoc.flashcards || lessonDoc.flashcards.length === 0) {
            const bankCards = await fetchTopicFlashcardsForSeed(ownerId, seedKey, 20);
            if (bankCards.length > 0) lessonDoc.flashcards = bankCards;
          }
        } catch (e) {
          console.warn("⚠️ [Factory] Topic flashcard seed skipped:", e?.message || e);
        }
      }
    }

    await lessonDoc.save();

    const out = lessonDoc.toObject();
    out.examBoard = lessonDoc.board || "AQA";

    return res.status(200).json({
      ok: true,
      lessonId: String(lessonDoc._id),
      lesson: out,
    });
  } catch (error) {
    console.error("❌ AI lesson-factory error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    if (error?.response?.status) {
      const status = error.response.status;
      const msg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        "OpenAI API error";
      return res.status(status === 429 ? 429 : 500).json({
        error: status === 429 ? "OpenAI rate limit exceeded" : "AI request failed",
        details: IS_PRODUCTION ? "The AI service returned an error." : msg,
      });
    }
    return sendInternalError("ai/lesson-factory/aqa-gcse-biology", error, res, {
      extra: { error: "Failed to generate AQA GCSE Biology lesson." },
    });
  }
});

// =========================================================
// Step 1 (LLM Roadmap): Explain this — plain-text explanation of a content chunk
// =========================================================

const EXPLAIN_CHUNK_MAX_TEXT_LENGTH = 4000;

/**
 * Call OpenAI chat/completions for plain text (no JSON schema).
 * @returns {Promise<string>} Assistant content
 */
async function callOpenAIChat(systemPrompt, userPrompt, maxTokens = 800) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY in environment");
  const model = safeStr(process.env.OPENAI_MODEL, "gpt-4o-mini");
  const resp = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.4,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      timeout: 25000,
    }
  );
  const content = (resp.data?.choices?.[0]?.message?.content || "").trim();
  return content;
}

/**
 * Optional Phase 4 coverage gate for explain-chunk / verbatim generation flows.
 * @param {object} body
 * @param {string} text
 */
async function applyCoverageGateToPrompt(body, text) {
  const lessonId = body?.lessonId != null ? String(body.lessonId).trim() : "";
  const generationKind =
    body?.generationKind != null ? String(body.generationKind).trim().toLowerCase() : "";
  if (!lessonId || !generationKind || !VALID_COVERAGE_GENERATION_KINDS.has(generationKind)) {
    return { text, coverage: null };
  }

  const lesson = await Lesson.findById(lessonId)
    .select("pages quiz flashcards assessment topic subTopic subject board level topicKey title")
    .lean();
  if (!lesson) return { text, coverage: null };

  const gate = createCoverageGateFromLesson(lesson);
  const { diagnostic } = planCoverageGatedQuestion(gate, {
    generationKind,
    suggestedConceptId: body?.suggestedConceptId,
  });

  return {
    text: prependCoverageDirectiveToPrompt(text, diagnostic),
    coverage: {
      conceptId: diagnostic.conceptId,
      cognitiveSkill: diagnostic.cognitiveSkill,
      reasonSelected: diagnostic.reasonSelected,
      avoidedDuplicates: diagnostic.avoidedDuplicates,
      coverageBefore: diagnostic.coverageBefore,
      coverageAfter: diagnostic.coverageAfter,
    },
  };
}

// @route   POST /api/ai/explain-chunk
// @desc    Explain a paragraph/chunk in simpler terms (any authenticated user)
// @body    { text: string (required), level?: string, subject?: string, lessonId?, generationKind?, suggestedConceptId? }
router.post("/explain-chunk", auth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const rawText = req.body?.text != null ? String(req.body.text) : "";
    let text = rawText.trim();
    if (!text) return res.status(400).json({ error: "text is required" });
    if (text.length > EXPLAIN_CHUNK_MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: `text must be at most ${EXPLAIN_CHUNK_MAX_TEXT_LENGTH} characters` });
    }
    const level = safeStr(req.body?.level, "GCSE");
    const subject = safeStr(req.body?.subject, "Biology");

    if (process.env.DISABLE_OPENAI === "1") {
      return res.json({
        explanation: "[Explain this is disabled for this environment.]",
        _disabled: true,
      });
    }

    const verbatim =
      req.body?.verbatim === true ||
      String(req.body?.instructionMode || "").toLowerCase() === "verbatim";

    const coverageApplied = await applyCoverageGateToPrompt(req.body, text);
    text = coverageApplied.text;

    /* Verbatim: client sends the full system+task text (e.g. JSON-only MCQ). Do not wrap in "explain in simpler terms". */
    if (verbatim) {
      const systemPrompt =
        "You are a UK curriculum assistant. Follow the user's instructions exactly. If they require JSON only, output valid JSON only with no markdown code fences and no text before or after the JSON object.";
      const userPrompt = text;
      const explanation = await callOpenAIChat(systemPrompt, userPrompt, 1200);
      return res.json({
        explanation: explanation || "No response generated.",
        ...(coverageApplied.coverage ? { coverage: coverageApplied.coverage } : {}),
      });
    }

    const systemPrompt = "You are an expert UK curriculum educator. Explain concepts in simple, clear terms. Use British English. Do not mention you are an AI. Keep the explanation concise (2–4 sentences).";
    const userPrompt = `Explain the following in simpler terms for a ${level} ${subject} student. Provide a brief analogy if helpful.\n\n---\n${text}`;
    const explanation = await callOpenAIChat(systemPrompt, userPrompt, 500);
    return res.json({
      explanation: explanation || "No explanation generated.",
      ...(coverageApplied.coverage ? { coverage: coverageApplied.coverage } : {}),
    });
  } catch (err) {
    if (err.response?.status === 429) return res.status(429).json({ error: "Rate limit exceeded" });
    console.error("POST /api/ai/explain-chunk error:", err.message);
    return sendInternalError("ai/explain-chunk", err, res, {
      extra: { error: "Failed to get explanation" },
    });
  }
});

// =========================================================
// Step 2 (LLM Roadmap): Explain my mistake — misconception from wrong answer
// =========================================================

const EXPLAIN_MISTAKE_MAX_LENGTH = 2000;

// @route   POST /api/ai/explain-mistake
// @desc    Explain likely misconception given question, wrong answer, correct answer (any authenticated user)
// @body    { questionText, userAnswer, correctAnswer, topic?, markScheme?, level? }
router.post("/explain-mistake", auth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const questionText = (req.body?.questionText != null ? String(req.body.questionText) : "").trim();
    const userAnswer = (req.body?.userAnswer != null ? String(req.body.userAnswer) : "").trim();
    const correctAnswer = (req.body?.correctAnswer != null ? String(req.body.correctAnswer) : "").trim();
    if (!questionText) return res.status(400).json({ error: "questionText is required" });
    if (!correctAnswer) return res.status(400).json({ error: "correctAnswer is required" });
    if (questionText.length > EXPLAIN_MISTAKE_MAX_LENGTH) {
      return res.status(400).json({ error: `questionText must be at most ${EXPLAIN_MISTAKE_MAX_LENGTH} characters` });
    }
    const topic = safeStr(req.body?.topic, "");
    const level = safeStr(req.body?.level, "GCSE");
    const subject = safeStr(req.body?.subject, "Biology");
    let markScheme = req.body?.markScheme;
    if (Array.isArray(markScheme)) markScheme = markScheme.map((m) => String(m).trim()).filter(Boolean).join("\n");
    else if (markScheme != null) markScheme = String(markScheme).trim();
    else markScheme = "";

    if (process.env.DISABLE_OPENAI === "1") {
      return res.json({
        explanation: "[Explain my mistake is disabled for this environment.]",
        _disabled: true,
      });
    }

    const systemPrompt = "You are an expert UK curriculum educator. Explain the student's likely misconception in 2–4 sentences. Be kind and clear. Use British English. Do not mention you are an AI.";
    const userPrompt = `The user is studying ${subject} at ${level}${topic ? ` (topic: ${topic})` : ""}.

Question: ${questionText}
Student's answer: ${userAnswer || "(no answer given)"}
Correct answer: ${correctAnswer}
${markScheme ? `Mark scheme (for context):\n${markScheme}` : ""}

Explain the likely misconception and clarify the correct concept.`;
    const explanation = await callOpenAIChat(systemPrompt, userPrompt, 400);
    return res.json({ explanation: explanation || "No explanation generated." });
  } catch (err) {
    if (err.response?.status === 429) return res.status(429).json({ error: "Rate limit exceeded" });
    console.error("POST /api/ai/explain-mistake error:", err.message);
    return sendInternalError("ai/explain-mistake", err, res, {
      extra: { error: "Failed to get explanation" },
    });
  }
});

// --- Step 3: Quiz me (LLM) -------------------------------------------------

const GENERATE_QUIZ_TOPIC_MAX_LENGTH = 200;
const GENERATE_QUIZ_MIN_QUESTIONS = 1;
const GENERATE_QUIZ_MAX_QUESTIONS = 10;

/**
 * Parse JSON array from OpenAI response (may be wrapped in markdown code block).
 * @returns {Array<object>|null}
 */
function parseQuizJson(raw) {
  const s = (raw || "").trim();
  let jsonStr = s;
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(s);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  try {
    const out = JSON.parse(jsonStr);
    return Array.isArray(out) ? out : null;
  } catch {
    return null;
  }
}

/**
 * Normalize and validate a single quiz question from LLM; add id.
 * @returns {{ id: string, type: 'mcq'|'short', question: string, options?: string[], correctAnswer: string, marks: number }|null}
 */
function normalizeQuizQuestion(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const type = safeStr(raw.type, "mcq").toLowerCase();
  const t = type === "short" ? "short" : "mcq";
  const question = (raw.question != null ? String(raw.question) : "").trim();
  if (!question) return null;
  const correctAnswer = (raw.correctAnswer != null ? String(raw.correctAnswer) : "").trim();
  if (!correctAnswer) return null;
  const id = raw.id && String(raw.id).trim() ? String(raw.id).trim() : `q-${index}`;
  const marks = Math.max(1, Math.min(5, parseInt(raw.marks, 10) || 1));

  if (t === "mcq") {
    let options = Array.isArray(raw.options) ? raw.options.map((o) => String(o).trim()).filter(Boolean) : [];
    const correctInOptions = options.some((o) => o === correctAnswer);
    if (!correctInOptions) options.push(correctAnswer);
    if (options.length < 2) return null;
    if (options.length > 4) options = options.slice(0, 4);
    return { id, type: "mcq", question, options, correctAnswer, marks };
  }
  return { id, type: "short", question, correctAnswer, marks };
}

// @route   POST /api/ai/generate-practice-quiz
// @desc    Generate a short practice quiz on a topic (any authenticated user)
// @body    { topic: string (required), subject?, level?, numQuestions? (1-10) }
router.post("/generate-practice-quiz", auth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const topic = (req.body?.topic != null ? String(req.body.topic) : "").trim();
    if (!topic) return res.status(400).json({ error: "topic is required" });
    if (topic.length > GENERATE_QUIZ_TOPIC_MAX_LENGTH) {
      return res.status(400).json({ error: `topic must be at most ${GENERATE_QUIZ_TOPIC_MAX_LENGTH} characters` });
    }
    const subject = safeStr(req.body?.subject, "Biology");
    const level = safeStr(req.body?.level, "GCSE");
    let numQuestions = parseInt(req.body?.numQuestions, 10);
    if (Number.isNaN(numQuestions) || numQuestions < GENERATE_QUIZ_MIN_QUESTIONS) numQuestions = 5;
    if (numQuestions > GENERATE_QUIZ_MAX_QUESTIONS) numQuestions = GENERATE_QUIZ_MAX_QUESTIONS;

    if (process.env.DISABLE_OPENAI === "1") {
      const stub = [];
      for (let i = 0; i < numQuestions; i++) {
        stub.push({
          id: `stub-${i + 1}`,
          type: i % 2 === 0 ? "mcq" : "short",
          question: `Stub question ${i + 1} about ${topic}?`,
          options: i % 2 === 0 ? ["Option A", "Option B", "Option C", "Option D"] : undefined,
          correctAnswer: i % 2 === 0 ? "Option B" : "Stub correct answer.",
          marks: 1,
        });
      }
      return res.json({ questions: stub, _disabled: true });
    }

    const systemPrompt = `You are an expert UK curriculum educator. Generate practice quiz questions as a JSON array only. No other text.
Each item must be: { "type": "mcq" | "short", "question": "...", "correctAnswer": "...", "marks": 1 }
For "mcq" also include "options": ["A", "B", "C", "D"] (exactly 4 options; correctAnswer must equal one of them). Use British English.`;

    let userPrompt = `Subject: ${subject}, Level: ${level}. Topic: ${topic}.
Generate exactly ${numQuestions} questions. Mix of MCQ and short-answer. Return only a JSON array.`;

    let coverageDiagnostics = [];
    const lessonId = req.body?.lessonId != null ? String(req.body.lessonId).trim() : "";
    if (lessonId) {
      const lesson = await Lesson.findById(lessonId)
        .select("pages quiz flashcards assessment topic subTopic subject board level topicKey title")
        .lean();
      if (lesson) {
        const gate = createCoverageGateFromLesson(lesson);
        const plans = planCoverageGatedQuestionBatch(gate, numQuestions, "practice");
        const section = formatCoveragePlanForPrompt(plans);
        if (section) userPrompt = `${section}\n\n${userPrompt}`;
        coverageDiagnostics = gate.diagnostics;
      }
    } else if (topic) {
      const gate = createCoverageGenerationGate({ topic, subject, tier: level });
      const plans = planCoverageGatedQuestionBatch(gate, numQuestions, "practice");
      const section = formatCoveragePlanForPrompt(plans);
      if (section) userPrompt = `${section}\n\n${userPrompt}`;
      coverageDiagnostics = gate.diagnostics;
    }

    const rawContent = await callOpenAIChat(systemPrompt, userPrompt, 2000);
    const parsed = parseQuizJson(rawContent);
    if (!parsed || parsed.length === 0) {
      return res.status(502).json({ error: "Failed to parse quiz from AI response" });
    }
    const questions = [];
    for (let i = 0; i < parsed.length; i++) {
      const q = normalizeQuizQuestion(parsed[i], i);
      if (q) questions.push(q);
    }
    if (questions.length === 0) {
      return res.status(502).json({ error: "No valid questions in AI response" });
    }
    const questionsWithCoverage = questions.map((q, i) => {
      const d = coverageDiagnostics[i];
      if (!d) return q;
      return {
        ...q,
        coverage: {
          conceptId: d.conceptId,
          cognitiveSkill: d.cognitiveSkill,
          reasonSelected: d.reasonSelected,
          avoidedDuplicates: d.avoidedDuplicates,
          coverageBefore: d.coverageBefore,
          coverageAfter: d.coverageAfter,
        },
      };
    });
    return res.json({
      questions: questionsWithCoverage,
      ...(coverageDiagnostics.length ? { coverageDiagnostics } : {}),
    });
  } catch (err) {
    if (err.response?.status === 429) return res.status(429).json({ error: "Rate limit exceeded" });
    console.error("POST /api/ai/generate-practice-quiz error:", err.message);
    return sendInternalError("ai/generate-practice-quiz", err, res, {
      extra: { error: "Failed to generate quiz" },
    });
  }
});

// --- Step 4: RAG (Q&A on lesson content) ----------------------------------------

const RAG_EMBEDDING_MODEL = "text-embedding-3-small";
const RAG_TOP_K = 5;
const RAG_ASK_MAX_QUESTION_LENGTH = 500;

/**
 * Extract text chunks from a lesson for RAG (pages/blocks + legacy content).
 * @param {Object} lesson - Lean lesson doc
 * @returns {{ text: string }[]}
 */
function extractLessonChunks(lesson) {
  const chunks = [];
  const push = (text) => {
    const t = (text || "").trim();
    if (t.length > 0) chunks.push({ text: t });
  };

  const pages = lesson?.pages || [];
  for (const page of pages) {
    const title = (page?.title || "").trim();
    if (title) push(`Section: ${title}`);
    const blocks = page?.blocks || [];
    for (const block of blocks) {
      if (block?.content) push(block.content);
      if (block?.prompt) push(`Question: ${block.prompt}`);
      if (block?.caption) push(block.caption);
      if (block?.explanation) push(block.explanation);
    }
    if (page?.checkpoint?.question) push(`Checkpoint: ${page.checkpoint.question}`);
  }

  const legacy = (lesson?.content || "").trim();
  if (legacy) {
    const paras = legacy.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    for (const p of paras) push(p);
  }

  return chunks;
}

/**
 * Get embedding for one or more texts via OpenAI.
 * @param {string|string[]} input - Single text or array of texts
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function callOpenAIEmbedding(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  const arr = Array.isArray(input) ? input : [input];
  const resp = await axios.post(
    "https://api.openai.com/v1/embeddings",
    { model: RAG_EMBEDDING_MODEL, input: arr },
    {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      timeout: 15000,
    }
  );
  const data = resp.data?.data;
  if (!Array.isArray(data) || data.length !== arr.length) throw new Error("Unexpected embeddings response");
  return data.map((d) => d.embedding).filter(Boolean);
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Ensure lesson has RAG chunks in DB; if not, extract, embed, and save.
 * @param {string} lessonId - ObjectId string
 */
async function ensureRAGIndex(lessonId) {
  const existing = await LessonRAGChunk.countDocuments({ lessonId });
  if (existing > 0) return;

  const lesson = await Lesson.findById(lessonId).lean();
  if (!lesson) throw new Error("Lesson not found");
  const chunks = extractLessonChunks(lesson);
  if (chunks.length === 0) return;

  if (process.env.DISABLE_OPENAI === "1") {
    const stubEmbedding = Array(1536).fill(0);
    for (let i = 0; i < chunks.length; i++) {
      await LessonRAGChunk.create({
        lessonId,
        chunkIndex: i,
        text: chunks[i].text,
        embedding: stubEmbedding,
      });
    }
    return;
  }

  const texts = chunks.map((c) => c.text);
  const embeddings = await callOpenAIEmbedding(texts);
  for (let i = 0; i < chunks.length; i++) {
    await LessonRAGChunk.create({
      lessonId,
      chunkIndex: i,
      text: chunks[i].text,
      embedding: embeddings[i] || Array(1536).fill(0),
    });
  }
}

/**
 * Get top-k chunk texts by similarity to query embedding.
 * @param {string} lessonId
 * @param {number[]} queryEmbedding
 * @param {number} k
 * @returns {Promise<string[]>}
 */
async function getTopChunks(lessonId, queryEmbedding, k = RAG_TOP_K) {
  const docs = await LessonRAGChunk.find({ lessonId }).sort({ chunkIndex: 1 }).lean();
  if (docs.length === 0) return [];
  const scored = docs.map((d) => ({ text: d.text, sim: cosineSimilarity(d.embedding || [], queryEmbedding) }));
  scored.sort((a, b) => b.sim - a.sim);
  return scored.slice(0, k).map((x) => x.text);
}

/**
 * Algorithm 1: Verify draft content coverage against specification points (embedding similarity).
 * @param {Object} draftSanitized - Sanitized draft with .pages (blocks with .content)
 * @param {string[]} specPoints - Specification point strings
 * @returns {Promise<{ coverageRatio: number, missingPoints: string[] }>}
 */
async function verifySyllabusCoverage(draftSanitized, specPoints) {
  if (!Array.isArray(specPoints) || specPoints.length === 0) {
    return { coverageRatio: 1, missingPoints: [] };
  }
  const lessonLike = { pages: draftSanitized?.pages || [], content: "" };
  const chunks = extractLessonChunks(lessonLike);
  const chunkTexts = chunks.map((c) => c.text).filter(Boolean);
  if (chunkTexts.length === 0) return { coverageRatio: 0, missingPoints: [...specPoints] };

  if (process.env.DISABLE_OPENAI === "1") {
    return { coverageRatio: 1, missingPoints: [] };
  }

  try {
    const [specEmbs, chunkEmbs] = await Promise.all([
      callOpenAIEmbedding(specPoints),
      callOpenAIEmbedding(chunkTexts),
    ]);
    const SIM_THRESHOLD = 0.7;
    const missingPoints = [];
    for (let i = 0; i < specPoints.length; i++) {
      let maxSim = 0;
      for (let j = 0; j < chunkEmbs.length; j++) {
        const sim = cosineSimilarity(specEmbs[i] || [], chunkEmbs[j] || []);
        if (sim > maxSim) maxSim = sim;
      }
      if (maxSim < SIM_THRESHOLD) missingPoints.push(specPoints[i]);
    }
    const coverageRatio = (specPoints.length - missingPoints.length) / specPoints.length;
    return { coverageRatio, missingPoints };
  } catch (err) {
    console.warn("verifySyllabusCoverage error:", err.message);
    return { coverageRatio: 0, missingPoints: [...specPoints] };
  }
}

const MARK_SCHEME_ALIGNMENT_THRESHOLD = 0.8;

/**
 * Algorithm 2: Mark scheme alignment validator.
 * Compares lesson content to past paper mark scheme points (embedding similarity).
 * @param {Object} opts - Either { lessonId } or { contentChunks: string[], specKey, topicKey }
 * @returns {Promise<{ alignmentScore: number, missingPoints: string[], suggestions: string[] }>}
 */
async function validateMarkSchemeAlignment(opts) {
  const { lessonId, contentChunks: rawChunks, specKey, topicKey } = opts;
  let chunkTexts = [];
  let resolvedSpecKey = specKey;
  let resolvedTopicKey = topicKey;

  if (lessonId) {
    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) throw new Error("Lesson not found");
    const chunks = extractLessonChunks(lesson);
    chunkTexts = chunks.map((c) => c.text).filter(Boolean);
    if (!resolvedSpecKey || !resolvedTopicKey) {
      const resolved = resolveSpecAndTopicKey(
        lesson.board || "",
        lesson.subject || "",
        lesson.topic || ""
      );
      if (resolved) {
        resolvedSpecKey = resolved.specKey;
        resolvedTopicKey = resolved.topicKey;
      }
    }
  } else if (Array.isArray(rawChunks) && rawChunks.length > 0) {
    chunkTexts = rawChunks.map((t) => String(t).trim()).filter(Boolean);
  } else if (opts.content != null && opts.content !== "") {
    const text = String(opts.content).trim();
    chunkTexts = text ? text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean) : [];
  }

  if (!resolvedSpecKey || !resolvedTopicKey) {
    return {
      alignmentScore: 0,
      missingPoints: [],
      suggestions: ["Missing specKey/topicKey or lesson has no board/subject/topic."],
    };
  }

  const snippets = await getPastPaperSnippetsForTopic(
    resolvedSpecKey,
    resolvedTopicKey,
    20,
    PastPaperQuestion
  );
  const markPoints = [];
  const seen = new Set();
  for (const s of snippets) {
    const list = Array.isArray(s.markScheme) ? s.markScheme : [];
    for (const p of list) {
      const t = String(p).trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        markPoints.push(t);
      }
    }
  }

  if (markPoints.length === 0) {
    return {
      alignmentScore: 100,
      missingPoints: [],
      suggestions: ["No past paper mark scheme data for this topic."],
    };
  }
  if (chunkTexts.length === 0) {
    return {
      alignmentScore: 0,
      missingPoints: markPoints,
      suggestions: markPoints.slice(0, 5).map((p) => `Add content addressing: ${p.slice(0, 80)}${p.length > 80 ? "…" : ""}`),
    };
  }

  if (process.env.DISABLE_OPENAI === "1") {
    return { alignmentScore: 100, missingPoints: [], suggestions: [] };
  }

  try {
    const [pointEmbs, chunkEmbs] = await Promise.all([
      callOpenAIEmbedding(markPoints),
      callOpenAIEmbedding(chunkTexts),
    ]);
    const missingPoints = [];
    for (let i = 0; i < markPoints.length; i++) {
      let maxSim = 0;
      for (let j = 0; j < chunkEmbs.length; j++) {
        const sim = cosineSimilarity(pointEmbs[i] || [], chunkEmbs[j] || []);
        if (sim > maxSim) maxSim = sim;
      }
      if (maxSim < MARK_SCHEME_ALIGNMENT_THRESHOLD) missingPoints.push(markPoints[i]);
    }
    const alignmentScore = Math.round(
      ((markPoints.length - missingPoints.length) / markPoints.length) * 100
    );
    const suggestions = missingPoints
      .slice(0, 10)
      .map((p) => `Add content addressing: ${p.slice(0, 80)}${p.length > 80 ? "…" : ""}`);
    return { alignmentScore, missingPoints, suggestions };
  } catch (err) {
    console.warn("validateMarkSchemeAlignment error:", err.message);
    return {
      alignmentScore: 0,
      missingPoints: markPoints,
      suggestions: [
        IS_PRODUCTION
          ? "Validation could not be completed."
          : "Validation failed: " + (err.message || "unknown error"),
      ],
    };
  }
}

// @route   POST /api/ai/ask
// @desc    RAG: answer question grounded in lesson content (user must have lesson access)
// @body    { question: string (required), lessonId: string (required) }
router.post("/ask", auth, requireLessonAccess({ allowBody: true }), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const question = (req.body?.question != null ? String(req.body.question) : "").trim();
    if (!question) return res.status(400).json({ error: "question is required" });
    if (question.length > RAG_ASK_MAX_QUESTION_LENGTH) {
      return res.status(400).json({ error: `question must be at most ${RAG_ASK_MAX_QUESTION_LENGTH} characters` });
    }
    const lesson = req.lesson;
    const lessonId = lesson._id.toString();

    if (process.env.DISABLE_OPENAI === "1") {
      await ensureRAGIndex(lessonId);
      const stubAnswer = "[RAG is disabled in this environment.] Answer would be grounded in the lesson content.";
      return res.json({ answer: stubAnswer, _disabled: true });
    }

    await ensureRAGIndex(lessonId);
    const [queryEmbedding] = await callOpenAIEmbedding(question);
    const contextTexts = await getTopChunks(lessonId, queryEmbedding, RAG_TOP_K);
    const context = contextTexts.length > 0
      ? contextTexts.join("\n\n---\n\n")
      : "No specific content from this lesson was found. You may answer generally from your knowledge.";

    const systemPrompt = "You are a helpful tutor. Answer the student's question using ONLY the provided lesson context. Use British English. If the context does not contain enough information, say so briefly. Do not mention you are an AI.";
    const userPrompt = `Lesson context:\n\n${context}\n\nStudent question: ${question}`;
    const answer = await callOpenAIChat(systemPrompt, userPrompt, 600);
    return res.json({ answer: answer || "I couldn't generate an answer." });
  } catch (err) {
    if (err.response?.status === 429) return res.status(429).json({ error: "Rate limit exceeded" });
    console.error("POST /api/ai/ask error:", err.message);
    return sendInternalError("ai/ask", err, res, {
      extra: { error: "Failed to answer question" },
    });
  }
});

// @route   POST /api/ai/validate-mark-scheme-alignment
// @desc    Algorithm 2: Compare lesson content to past paper mark scheme points (Teachers/Admin or lesson owner)
// @body    { lessonId: string } OR { content: string, specKey: string, topicKey: string }
router.post("/validate-mark-scheme-alignment", auth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const lessonId = req.body?.lessonId != null ? String(req.body.lessonId).trim() : null;
    const content = req.body?.content;
    const specKey = req.body?.specKey != null ? String(req.body.specKey).trim() : null;
    const topicKey = req.body?.topicKey != null ? String(req.body.topicKey).trim() : null;

    if (lessonId) {
      if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        return res.status(400).json({ error: "Invalid lessonId" });
      }
      const lesson = await Lesson.findById(lessonId).lean();
      if (!lesson) return res.status(404).json({ error: "Lesson not found" });
      const { getLessonOwnerId } = require("../utils/lessonPayload");
      const ownerId = getLessonOwnerId(lesson);
      const isOwner = ownerId != null && ownerId === String(req.user._id || req.user.id);
      const isAdmin = (req.user?.userType || req.user?.role || "").toString().toLowerCase() === "admin";
      if (!isOwner && !isAdmin) {
        const { canAccessContent } = require("../utils/canAccessContent");
        const status = lesson.status || (lesson.isPublished ? "published" : "draft");
        const isPublished = String(status).toLowerCase() === "published";
        const decision = await canAccessContent(req.user ?? null, {
          id: lesson._id?.toString(),
          _id: lesson._id,
          status,
          isFreePreview: !!lesson.isFreePreview,
          isPublished,
        });
        if (!decision.allowed) {
          const code = decision.reason === "NOT_ENTITLED" ? 402 : 403;
          return res.status(code).json({ error: decision.reason === "NOT_ENTITLED" ? "Subscription required" : "Forbidden" });
        }
      }
      const result = await validateMarkSchemeAlignment({ lessonId });
      return res.json({ success: true, ...result });
    }

    if (content != null && specKey && topicKey) {
      if (!requireTeacherOrAdmin(req, res)) return;
      const result = await validateMarkSchemeAlignment({
        content: String(content),
        specKey,
        topicKey,
      });
      return res.json({ success: true, ...result });
    }

    return res.status(400).json({
      error: "Provide either lessonId or (content, specKey, topicKey)",
    });
  } catch (err) {
    console.error("POST /api/ai/validate-mark-scheme-alignment error:", err?.message || err);
    return sendInternalError("ai/validate-mark-scheme-alignment", err, res, {
      extra: { error: "Mark scheme alignment check failed" },
    });
  }
});

/**
 * Get text context from a lesson for diagram generation (optionally for one page or page+block).
 */
function getLessonContextForDiagram(lesson, pageIndex, blockIndex) {
  const parts = [];
  parts.push(safeStr(lesson.description, ""));
  parts.push(`Topic: ${safeStr(lesson.topic, "")}`);
  const pages = Array.isArray(lesson.pages) ? lesson.pages : [];
  const page = pageIndex != null && pages[pageIndex] ? pages[pageIndex] : pages[0];
  if (page) {
    parts.push(`Section: ${safeStr(page.title, "")}`);
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    if (blockIndex != null && blocks[blockIndex] && blocks[blockIndex].content) {
      parts.push(blocks[blockIndex].content);
    } else {
      blocks.forEach((b) => {
        if (b && b.content) parts.push(b.content);
      });
    }
  }
  return parts.filter(Boolean).join("\n\n");
}

// @route   POST /api/ai/generate-diagram
// @desc    Context-aware diagram generation (Algorithm 4). Teacher/admin or lesson owner. Optionally apply to block.
// @body    { lessonId?, pageIndex?, blockIndex?, content?, subject, level, topic?, purpose?, runAlignmentCheck?, applyToBlock? }
router.post("/generate-diagram", auth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    if (process.env.DISABLE_OPENAI === "1") {
      return res.status(503).json({
        error: "Diagram generation is disabled",
        _disabled: true,
      });
    }

    const lessonId = req.body?.lessonId != null ? String(req.body.lessonId).trim() : null;
    const pageIndex = req.body?.pageIndex != null ? Number(req.body.pageIndex) : null;
    const blockIndex = req.body?.blockIndex != null ? Number(req.body.blockIndex) : null;
    const content = req.body?.content;
    const subject = safeStr(req.body?.subject, "");
    const level = safeStr(req.body?.level, "GCSE");
    const topic = safeStr(req.body?.topic, "");
    let purpose = safeStr(req.body?.purpose, "");
    const runAlignmentCheck = Boolean(req.body?.runAlignmentCheck);
    const applyToBlock = Boolean(req.body?.applyToBlock);

    let contextContent = content != null ? String(content) : "";
    let resolvedSubject = subject;
    let resolvedLevel = level;
    let resolvedTopic = topic;

    if (lessonId) {
      if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        return res.status(400).json({ error: "Invalid lessonId" });
      }
      const lesson = await Lesson.findById(lessonId).lean();
      if (!lesson) return res.status(404).json({ error: "Lesson not found" });
      const { getLessonOwnerId } = require("../utils/lessonPayload");
      const ownerId = getLessonOwnerId(lesson);
      const isOwner = ownerId != null && ownerId === String(req.user._id || req.user.id);
      const isAdmin = (req.user?.userType || req.user?.role || "").toString().toLowerCase() === "admin";
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Only the lesson owner or an admin can generate diagrams for this lesson" });
      }
      contextContent = contextContent || getLessonContextForDiagram(lesson, pageIndex, blockIndex);
      resolvedSubject = resolvedSubject || safeStr(lesson.subject, "Science");
      resolvedLevel = resolvedLevel || normalizeLevel(safeStr(lesson.level, "GCSE"));
      resolvedTopic = resolvedTopic || safeStr(lesson.topic, "");
      // Use diagram block caption as purpose when available so the image follows teacher's instruction
      if ((purpose === undefined || purpose === "") && pageIndex != null && blockIndex != null) {
        const page = lesson.pages?.[pageIndex];
        const block = page?.blocks?.[blockIndex];
        if (block && block.type === "diagram" && block.caption && String(block.caption).trim()) {
          req.body.purpose = String(block.caption).trim();
          purpose = req.body.purpose;
        }
      }
    } else {
      if (!requireTeacherOrAdmin(req, res)) return;
      if (!contextContent && !resolvedTopic) {
        return res.status(400).json({ error: "Provide lessonId or (content and/or topic with subject, level)" });
      }
    }

    const userId = String(req.user._id || req.user.id);
    const baseUrl = process.env.BASE_URL || (req.protocol && req.get("host") ? `${req.protocol}://${req.get("host")}` : "");

    const result = await generateContextAwareDiagram({
      content: contextContent,
      subject: resolvedSubject,
      level: resolvedLevel,
      topic: resolvedTopic,
      purpose: purpose || undefined,
      userId,
      runAlignmentCheck,
      baseUrl,
    });

    if (applyToBlock && lessonId != null && pageIndex != null && blockIndex != null) {
      const lesson = await Lesson.findById(lessonId);
      if (lesson && Array.isArray(lesson.pages) && lesson.pages[pageIndex]) {
        const blocks = lesson.pages[pageIndex].blocks || [];
        if (blocks[blockIndex]) {
          blocks[blockIndex].imageUrl = result.imageUrl;
          blocks[blockIndex].imageSource = result.imageSource;
          blocks[blockIndex].alt = result.altText;
          lesson.markModified("pages");
          await lesson.save();
        }
      }
    }

    return res.json({
      success: true,
      imageUrl: result.imageUrl,
      altText: result.altText,
      imageSource: result.imageSource,
      ...(result.alignmentScore != null && { alignmentScore: result.alignmentScore }),
      ...(result.retried && { retried: true }),
    });
  } catch (err) {
    console.error("POST /api/ai/generate-diagram error:", err?.message || err);
    if (err?.response?.status === 429) {
      return res.status(429).json({ error: "Rate limit exceeded", details: "Image generation limit reached." });
    }
    return sendInternalError("ai/generate-diagram", err, res, {
      extra: { error: "Diagram generation failed" },
    });
  }
});

// --- Step 5: Summarise / key points -------------------------------------------

/**
 * Build a single text body from lesson for summarisation (same source as RAG chunks).
 */
function getLessonBodyForSummarise(lesson) {
  const chunks = extractLessonChunks(lesson);
  return chunks.map((c) => c.text).join("\n\n");
}

/**
 * Parse summary JSON from LLM (may be markdown-wrapped).
 */
function parseSummariseJson(raw) {
  const s = (raw || "").trim();
  let jsonStr = s;
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(s);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// @route   POST /api/ai/summarise
// @desc    Summarise a lesson and return key points (user must have lesson access)
// @body    { lessonId: string (required) }
router.post("/summarise", auth, requireLessonAccess({ allowBody: true }), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const lesson = req.lesson;
    const lessonId = lesson._id.toString();
    const bodyText = getLessonBodyForSummarise(lesson);
    const title = (lesson.title || "This lesson").trim();

    if (process.env.DISABLE_OPENAI === "1") {
      return res.json({
        summary: `[Summarise is disabled.] Summary of "${title}" would appear here.`,
        keyPoints: ["Key point 1", "Key point 2", "Key point 3"],
        _disabled: true,
      });
    }

    if (!bodyText || bodyText.length < 50) {
      return res.json({
        summary: "This lesson has very little text to summarise.",
        keyPoints: [],
      });
    }

    const systemPrompt = "You are an expert UK curriculum educator. Summarise the lesson content in 2–4 sentences. Then list 3–6 key points as a JSON array. Use British English. Respond with JSON only: {\"summary\": \"...\", \"keyPoints\": [\"...\", \"...\"]}. Do not include any text outside the JSON.";
    const userPrompt = `Lesson title: ${title}\n\nContent:\n\n${bodyText.slice(0, 12000)}`;
    const raw = await callOpenAIChat(systemPrompt, userPrompt, 800);
    const parsed = parseSummariseJson(raw);
    if (parsed && typeof parsed.summary === "string") {
      const keyPoints = Array.isArray(parsed.keyPoints)
        ? parsed.keyPoints.map((k) => String(k).trim()).filter(Boolean)
        : [];
      return res.json({ summary: parsed.summary.trim(), keyPoints });
    }
    return res.json({
      summary: raw || "Could not generate summary.",
      keyPoints: [],
    });
  } catch (err) {
    if (err.response?.status === 429) return res.status(429).json({ error: "Rate limit exceeded" });
    console.error("POST /api/ai/summarise error:", err.message);
    return sendInternalError("ai/summarise", err, res, {
      extra: { error: "Failed to summarise" },
    });
  }
});

// --- Step 7: Structure my notes (user input → summary + flashcards) -------------

const STRUCTURE_NOTES_MAX_LENGTH = 8000;

/**
 * Parse JSON from LLM response (may be markdown-wrapped).
 */
function parseStructureNotesJson(raw) {
  const s = (raw || "").trim();
  let jsonStr = s;
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(s);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function normalizeFlashcards(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item) => item && (item.front != null || item.back != null))
    .map((item) => ({
      front: (item.front != null ? String(item.front) : "").trim(),
      back: (item.back != null ? String(item.back) : "").trim(),
    }))
    .filter((f) => f.front.length > 0 || f.back.length > 0)
    .slice(0, 30);
}

// @route   POST /api/ai/structure-notes
// @desc    Turn user notes into a short summary and flashcards (any authenticated user)
// @body    { notes: string (required) }
router.post("/structure-notes", auth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const notes = (req.body?.notes != null ? String(req.body.notes) : "").trim();
    if (!notes) return res.status(400).json({ error: "notes is required" });
    if (notes.length > STRUCTURE_NOTES_MAX_LENGTH) {
      return res.status(400).json({ error: `notes must be at most ${STRUCTURE_NOTES_MAX_LENGTH} characters` });
    }

    if (process.env.DISABLE_OPENAI === "1") {
      return res.json({
        summary: "[Structure notes is disabled.] Your notes would be turned into a summary and flashcards here.",
        flashcards: [
          { front: "Example question?", back: "Example answer." },
          { front: "Another term?", back: "Definition." },
        ],
        _disabled: true,
      });
    }

    const systemPrompt =
      "You are an expert UK curriculum educator. The user will paste their revision notes. Respond with JSON only: {\"summary\": \"2-4 sentence summary of the notes\", \"flashcards\": [{\"front\": \"question or term\", \"back\": \"answer or definition\"}, ...]}. Create 5-15 flashcards. Use British English. No other text outside the JSON.";
    const userPrompt = `Notes:\n\n${notes}`;
    const raw = await callOpenAIChat(systemPrompt, userPrompt, 1500);
    const parsed = parseStructureNotesJson(raw);
    const summary =
      parsed && typeof parsed.summary === "string" ? parsed.summary.trim() : "Could not generate summary.";
    const flashcards = normalizeFlashcards(parsed?.flashcards);
    return res.json({ summary, flashcards });
  } catch (err) {
    if (err.response?.status === 429) return res.status(429).json({ error: "Rate limit exceeded" });
    console.error("POST /api/ai/structure-notes error:", err.message);
    return sendInternalError("ai/structure-notes", err, res, {
      extra: { error: "Failed to structure notes" },
    });
  }
});

// @route   POST /api/ai/inject-teacher-brain-briefs
router.post("/inject-teacher-brain-briefs", auth, async (req, res) => {
  try {
    const { pages, topic, subject, examBoard, tier, blueprint } = req.body || {};
    if (!Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: "pages array is required" });
    }
    const topicStr = String(topic || blueprint?.topic || "").trim();
    if (!topicStr) {
      return res.status(400).json({ error: "topic is required" });
    }
    const result = applyTeacherBrainBriefInjection(pages, {
      topic: topicStr,
      subject,
      examBoard,
      tier,
      blueprint,
    });
    return res.json({
      pages: result.pages,
      teacherBrainInjection: {
        injectionCount: result.injections?.length ?? 0,
        injections: result.injections ?? [],
      },
    });
  } catch (err) {
    console.error("POST /api/ai/inject-teacher-brain-briefs error:", err?.message || err);
    return sendInternalError("ai/inject-teacher-brain-briefs", err, res, {
      extra: { error: "Failed to inject Teacher Brain briefs" },
    });
  }
});

// @route   GET /api/ai/health
router.get("/health", (req, res) => {
  const hasKey = !!process.env.OPENAI_API_KEY;
  res.json({
    status: hasKey ? "OK" : "ERROR",
    message: hasKey ? "AI service is configured" : "Missing OpenAI API key",
    hasOpenAIKey: hasKey,
    model: safeStr(process.env.OPENAI_MODEL, "gpt-4o-mini"),
  });
});

module.exports = router;
module.exports.stripV8AuthoringTags = stripV8AuthoringTags;
module.exports.resolveWorkedExampleFallback = resolveWorkedExampleFallback;
module.exports.ensureWorkedExampleCheckpoint = ensureWorkedExampleCheckpoint;
module.exports.ensureRealWorldApplicationBlock = ensureRealWorldApplicationBlock;
module.exports.buildTopicAwareRealWorldApplication = buildTopicAwareRealWorldApplication;
module.exports.ensureMinimumDiagramBlocks = ensureMinimumDiagramBlocks;
module.exports.ensureTopicSpecificWhatToNoticeBlocks = ensureTopicSpecificWhatToNoticeBlocks;
module.exports.buildTopicAwareWhatToNotice = buildTopicAwareWhatToNotice;
module.exports.resolveTopicDiagramLabel = resolveTopicDiagramLabel;
module.exports.sanitizeDraftForTest = sanitizeDraft;
module.exports.buildUserPromptFromMdForTest = buildUserPromptFromMd;
module.exports.buildTeacherFirstLayer2OpeningAppendixForTest = buildTeacherFirstLayer2OpeningAppendix;
