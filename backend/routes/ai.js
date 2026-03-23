// backend/routes/ai.js
const express = require("express");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const router = express.Router();
const auth = require("../middleware/auth");

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
const { findDefaultCellVisualId } = require("../utils/defaultCellVisual");
const { generateContextAwareDiagram } = require("../services/diagramGeneration");
const { findTopicByKey, findTopicBySpecAndKey, topicToKey, isValidTopicForSpec } = require("../utils/topicTaxonomy");
const { validateGeneratedContentAgainstTopic } = require("../utils/topicDriftValidation");
const { queryCandidates, DEFAULT_SPEC_LEGACY, parseTopicKey } = require("../utils/topicKey");
const { autoAttachLessonContent } = require("../services/autoAttachLessonContentService");
const { buildBoardPromptFragment } = require("../config/aiLessonBoardConfig");
const { validateLessonDraftAgainstCurriculum } = require("../services/lessonDraftValidation");

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
 * JSON Schema for Structured Outputs
 * - Matches your Lesson.pages[] structure in backend/models/Lesson.js
 * - We keep pageId out of the AI output (server generates it on save)
 * - PR: Single-page default — exactly 1 page, subsection labels become blocks not pages
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
              required: ["type", "content", "prompt", "questionType", "options", "correctAnswer", "explanation"],
              properties: {
                type: {
                  type: "string",
                  enum: ["text", "keyIdea", "examTip", "commonMistake", "stretch", "checkpoint"],
                },
                content: { type: "string" },
                prompt: { type: "string" },
                questionType: { type: "string", enum: ["mcq", "short"] },
                options: { type: "array", items: { type: "string" } },
                correctAnswer: { type: "string" },
                explanation: { type: "string" },
              },
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

function buildSystemPrompt(subject, level) {
  // Keep system prompt short; main rules live in the md template.
  return [
    `You are an expert UK curriculum educator.`,
    `Write for ${normalizeLevel(level)} ${safeStr(subject)} students.`,
    `Be accurate, exam-focused, student-friendly, British English.`,
    `Return ONLY valid JSON.`,
  ].join(" ");
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
  out += buildBoardPromptFragment(board);
  return out;
}

/**
 * Calls OpenAI Responses API with Structured Outputs.
 */
async function callOpenAI({ systemPrompt, userPrompt }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY in environment");

  const model = safeStr(process.env.OPENAI_MODEL, "gpt-4o-mini");

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

  const resp = await axios.post("https://api.openai.com/v1/responses", payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 60000,
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

function sanitizeDraft(draft, { subject, level, topic }) {
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
        .map((b) => {
          const type = normalizeBlockType(b?.type);
          if (type === "checkpoint") {
            const prompt = safeStr(b?.prompt, "").trim();
            const options = Array.isArray(b?.options)
              ? b.options.map((o) => safeStr(o, "")).filter(Boolean).slice(0, 6)
              : [];
            const questionType =
              b?.questionType === "short" ? "short" : (options.length > 0 ? "mcq" : "short");
            const finalOptions =
              questionType === "mcq" && options.length === 0 ? ["A", "B", "C", "D"] : options;
            return {
              type: "checkpoint",
              prompt: prompt || "Quick check",
              questionType,
              options: finalOptions,
              correctAnswer: safeStr(b?.correctAnswer, ""),
              explanation: safeStr(b?.explanation, ""),
            };
          }
          if (type === "diagram") {
            return {
              type: "diagram",
              visualId: b?.visualId,
              caption: safeStr(b?.caption, ""),
            };
          }
          return {
            type,
            content: safeStr(b?.content, ""),
          };
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
}) {
  const systemPrompt = buildSystemPrompt(subject, level);
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
  });

  const ai = await callOpenAI({ systemPrompt, userPrompt });

  let draft;
  try {
    draft = JSON.parse(ai.raw);
  } catch (e) {
    const snippet = typeof ai.raw === "string" ? ai.raw.slice(0, 200) : "";
    throw new Error(`AI returned invalid JSON. Snippet: ${snippet}`);
  }

  const sanitized = sanitizeDraft(draft, { subject, level, topic });
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

    let { sanitized, ai } = await generateSanitizedDraft({
      topic,
      subject,
      level,
      board,
      tier,
      specPoints,
      pastPaperSnippets,
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
        details: msg,
      });
    }

    return res.status(500).json({
      error: "Failed to generate lesson draft.",
      details:
        process.env.NODE_ENV === "development"
          ? String(error?.message || error)
          : undefined,
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

    // Use exact topicKey for retrieval (no prefix/broad matching)
    let specPoints = getSpecPointsForTopic(specKey, canonicalTopicKey) || [];
    let pastPaperSnippets = await getPastPaperSnippetsForTopic(
      specKey,
      canonicalTopicKey,
      5,
      PastPaperQuestion
    );

    const thinCoverage = specPoints.length === 0;

    // ✅ 2) Generate AI draft (sanitized) with sub-topic scope guardrails
    const { sanitized } = await generateSanitizedDraft({
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
    });

    // ✅ 2b) Curriculum validation layer
    const generationValidation = validateLessonDraftAgainstCurriculum(sanitized, {
      specPoints,
      requiredKeywords,
      requiredMisconceptions,
      requireExamQuestions: true,
    });

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
        blocks.unshift({
          type: "diagram",
          visualId,
          caption: "Basic cell structure",
          mode: "annotated",
          annotations: [],
          steps: [],
        });
        pagesMerged[0] = { ...page0, blocks };
      } else if (!visualId) {
        console.warn("⚠️ No default cell visual found; skipping fallback diagram injection");
      }
    }

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

      // Gold structure
      pages: pagesMerged,

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
      metadata: { generationValidation },
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
          pages: pagesMerged,
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
      generationValidation,
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
        details: msg,
        ...(body?.error?.code && { code: body.error.code }),
      };
      return res.status(status).json(payload);
    }

    // Include actual error message so user can debug (e.g. missing key, invalid schema)
    const details = error?.message ? String(error.message) : undefined;
    return res.status(500).json({
      error: "Failed to generate lesson materials",
      ...(details && { details }),
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

    const first = safeStr(req.user?.firstName, "");
    const last = safeStr(req.user?.lastName, "");
    const teacherName =
      first || last ? `${first} ${last}`.trim() : safeStr(req.user?.email, "Teacher");

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
      pages,
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
        details: msg,
      });
    }
    return res.status(500).json({
      error: "Failed to generate AQA GCSE Biology lesson.",
      details:
        process.env.NODE_ENV === "development"
          ? String(error?.message || error)
          : undefined,
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

// @route   POST /api/ai/explain-chunk
// @desc    Explain a paragraph/chunk in simpler terms (any authenticated user)
// @body    { text: string (required), level?: string, subject?: string }
router.post("/explain-chunk", auth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const rawText = req.body?.text != null ? String(req.body.text) : "";
    const text = rawText.trim();
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

    const systemPrompt = "You are an expert UK curriculum educator. Explain concepts in simple, clear terms. Use British English. Do not mention you are an AI. Keep the explanation concise (2–4 sentences).";
    const userPrompt = `Explain the following in simpler terms for a ${level} ${subject} student. Provide a brief analogy if helpful.\n\n---\n${text}`;
    const explanation = await callOpenAIChat(systemPrompt, userPrompt, 500);
    return res.json({ explanation: explanation || "No explanation generated." });
  } catch (err) {
    if (err.response?.status === 429) return res.status(429).json({ error: "Rate limit exceeded" });
    console.error("POST /api/ai/explain-chunk error:", err.message);
    return res.status(500).json({ error: err.message || "Failed to get explanation" });
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
    return res.status(500).json({ error: err.message || "Failed to get explanation" });
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

    const userPrompt = `Subject: ${subject}, Level: ${level}. Topic: ${topic}.
Generate exactly ${numQuestions} questions. Mix of MCQ and short-answer. Return only a JSON array.`;

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
    return res.json({ questions });
  } catch (err) {
    if (err.response?.status === 429) return res.status(429).json({ error: "Rate limit exceeded" });
    console.error("POST /api/ai/generate-practice-quiz error:", err.message);
    return res.status(500).json({ error: err.message || "Failed to generate quiz" });
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
      suggestions: ["Validation failed: " + (err.message || "unknown error")],
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
    return res.status(500).json({ error: err.message || "Failed to answer question" });
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
    return res.status(500).json({
      error: "Mark scheme alignment check failed",
      details: process.env.NODE_ENV === "development" ? String(err?.message || err) : undefined,
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
    return res.status(500).json({
      error: "Diagram generation failed",
      details: process.env.NODE_ENV === "development" ? String(err?.message || err) : undefined,
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
    return res.status(500).json({ error: err.message || "Failed to summarise" });
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
    return res.status(500).json({ error: err.message || "Failed to structure notes" });
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