// backend/routes/ai.js
const express = require("express");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const auth = require("../middleware/auth");

const Lesson = require("../models/Lesson"); // ✅ needed for generate-and-save

// ✅ ADDED: Import for curated visuals
const { findCuratedVisual } = require("../utils/curatedVisuals");

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
  const allowed = ["text", "keyIdea", "examTip", "commonMistake"];
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

/**
 * JSON Schema for Structured Outputs
 * - Matches your Lesson.pages[] structure in backend/models/Lesson.js
 * - We keep pageId out of the AI output (server generates it on save)
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
      minItems: 2,
      maxItems: 6,
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
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["type", "content"],
              properties: {
                type: {
                  type: "string",
                  enum: ["text", "keyIdea", "examTip", "commonMistake"],
                },
                content: { type: "string" },
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
- Create 3 to 5 lesson pages
- Each page must include:
  - Clear explanation text (at least one "text" block)
  - At least one "keyIdea", "examTip", or "commonMistake" block
  - One checkpoint question with EXACTLY 4 options
  - The "answer" must match one of the 4 options EXACTLY

TAGS RULE:
- Provide 5–12 short tags (single words or short phrases)

OUTPUT SCHEMA (DO NOT CHANGE):

{
  "title": "string",
  "description": "string",
  "estimatedDuration": number,
  "tags": ["string"],
  "board": "string",
  "tier": "string",
  "pages": [
    {
      "title": "string",
      "order": number,
      "pageType": "string",
      "blocks": [
        { "type": "text | keyIdea | examTip | commonMistake", "content": "string" }
      ],
      "checkpoint": {
        "question": "string",
        "options": ["string", "string", "string", "string"],
        "answer": "string"
      }
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

function buildUserPromptFromMd({ topic, subject, level, board, tier }) {
  const lvl = normalizeLevel(level);
  const tierFinal = lvl === "GCSE" ? normalizeTier(tier) : ""; // non-GCSE => empty string

  return injectPromptVars(AI_LESSON_PROMPT_TEMPLATE, {
    topic,
    subject,
    level: lvl,
    board: board === undefined || board === null ? "" : String(board),
    tier: tierFinal,
  });
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
      const blocks = blocksRaw
        .map((b) => ({
          type: normalizeBlockType(b?.type),
          content: safeStr(b?.content, ""),
        }))
        .filter((b) => b.content.trim().length > 0);

      const cp = p?.checkpoint || {};
      const options = clampOptions(cp?.options);
      while (options.length < 4) options.push(`Option ${options.length + 1}`);

      const answer = safeStr(cp?.answer, "");
      const answerOk = options.some((o) => o.trim() === answer.trim());

      return {
        title: safeStr(p?.title, `Page ${idx + 1}`),
        order: Number.isFinite(Number(p?.order)) ? Number(p.order) : idx + 1,
        pageType: safeStr(p?.pageType, ""),
        blocks: blocks.length
          ? blocks
          : [{ type: "text", content: "Content coming soon." }],
        checkpoint: {
          question: safeStr(
            cp?.question,
            "Quick check: which statement is correct?"
          ),
          options: options.slice(0, 4),
          answer: answerOk ? answer : options[0],
        },
      };
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .slice(0, 6);

  if (!clean.pages.length) {
    clean.pages = [
      {
        title: "Page 1",
        order: 1,
        pageType: "",
        blocks: [{ type: "text", content: `## ${safeStr(topic)}\n\nAdd content here.` }],
        checkpoint: {
          question: "Which statement is correct?",
          options: ["Option 1", "Option 2", "Option 3", "Option 4"],
          answer: "Option 1",
        },
      },
      {
        title: "Page 2",
        order: 2,
        pageType: "",
        blocks: [{ type: "text", content: "## Worked example\n\nAdd content here." }],
        checkpoint: {
          question: "Which statement is correct?",
          options: ["Option 1", "Option 2", "Option 3", "Option 4"],
          answer: "Option 1",
        },
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
async function generateSanitizedDraft({ topic, subject, level, board, tier }) {
  const systemPrompt = buildSystemPrompt(subject, level);
  const userPrompt = buildUserPromptFromMd({
    topic,
    subject,
    level,
    board,
    tier,
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

    const { sanitized, ai } = await generateSanitizedDraft({
      topic,
      subject,
      level,
      board,
      tier,
    });

    return res.json({
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
    });
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
      `🤖 AI generate-and-save (clone-first): user=${getAuthUserId(req)} type=${req.user.userType} | ${subject} | ${level} | ${topic}`
    );

    // ✅ 1) Find the single Gold Standard master template
    const gold = await Lesson.findOne({ isTemplate: true }).lean();
    if (!gold) {
      return res.status(500).json({
        error: "Gold template missing",
        details: "No Lesson found with isTemplate:true. Seed the Gold Standard Master Template first.",
      });
    }

    // ✅ 2) Generate AI draft (sanitized)
    const { sanitized } = await generateSanitizedDraft({
      topic,
      subject,
      level,
      board,
      tier,
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

    // ✅ 5) Clone template pages (keep EXACT 7 pages + pageIds from template)
    // If any template page lacks pageId for some reason, ensure it.
    const templatePages = Array.isArray(gold.pages) ? gold.pages : [];
    const pagesCloned = templatePages.map((p, idx) => ({
      pageId: safeStr(p?.pageId, "") || makePageIdFallback(idx),
      title: safeStr(p?.title, `Page ${idx + 1}`),
      order: Number.isFinite(Number(p?.order)) ? Number(p.order) : idx + 1,
      pageType: safeStr(p?.pageType, ""),
      hero: p?.hero,
      visualModelId: p?.visualModelId,
      checkpoint: p?.checkpoint,
      blocks: Array.isArray(p?.blocks) ? p.blocks : [],
    }));

    // ✅ 6) Merge AI content into the cloned pages (best-effort, preserves 7-page structure)
    // We take AI pages (2-6) and map them onto the first N template pages by order.
    // ✅ Use ensurePageIds which now preserves hero field
    const aiPages = ensurePageIds(sanitized.pages); // ensures pageId exists and preserves hero
    const byOrder = new Map(aiPages.map((p) => [Number(p.order || 0), p]));

    const pagesMerged = pagesCloned
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((tp, i) => {
        const ai = byOrder.get(i + 1) || null;

        // If we have AI content for this slot, replace blocks + checkpoint only.
        // Keep existing hero from template or curated visual
        if (ai) {
          return {
            ...tp,
            blocks: Array.isArray(ai.blocks) && ai.blocks.length ? ai.blocks : tp.blocks,
            checkpoint: ai.checkpoint || tp.checkpoint,
            // Preserve hero: use AI hero if exists (from curated visuals), otherwise template hero
            hero: ai.hero || tp.hero,
          };
        }

        return tp;
      });

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

      // Gold structure
      pages: pagesMerged,

      // Ownership
      teacherId: req.user?._id || req.user?.userId || req.user?.id,
      teacherName,

      // Status
      status: "draft",
      isPublished: false,

      // ✅ Template tracking (agreed)
      isTemplate: false,
      createdFromTemplate: true,
      templateSource: gold._id,
    });

    await lessonDoc.save();

    return res.json({
      success: true,
      message: "AI draft saved from Gold Template clone.",
      lessonId: String(lessonDoc._id),
      title: lessonDoc.title,
      pagesCount: Array.isArray(lessonDoc.pages) ? lessonDoc.pages.length : 0,
      templateSource: String(gold._id),
    });
  } catch (error) {
    console.error("❌ AI generate-and-save error:", error?.message || error);

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
      error: "Failed to generate and save lesson draft.",
      details:
        process.env.NODE_ENV === "development"
          ? String(error?.message || error)
          : undefined,
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