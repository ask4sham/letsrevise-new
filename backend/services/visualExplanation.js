/**
 * P1 GCSE Visual Explanation — two-stage generator (response-only v1).
 * Stage 1: structured 8-section JSON via OpenAI.
 * Stage 2: labelled diagram via OpenAI gpt-image-1-mini (best-effort; never fails the request).
 */
const axios = require("axios");
const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const { callOpenAIImages } = require("./diagramGeneration");
const { buildFinalImagePrompt } = require("../../lib/visualExplanation/buildVisualExplanationPrompt");

const EXPLAIN_SCHEMA_DESC = `
Return a SINGLE JSON object (no markdown fences, no commentary):

{
  "what_image_shows": "<one sentence — what the diagram depicts>",
  "key_parts": [
    {"label": "<part>", "what": "<one line — what it does>"}
  ],
  "step_by_step": [
    "<step 1 in plain GCSE language>",
    "<step 2 …>",
    "<step 3 …>"
  ],
  "why_it_matters_gcse": "<one short paragraph — why this is examined at GCSE>",
  "common_mistake": "<one sentence — the classic wrong answer students give>",
  "exam_tip": "<one sentence — examiner language that wins the mark>",
  "exam_question": "<a typical GCSE exam question, with mark allocation in brackets>",
  "model_answer": "<a full-mark model answer using GCSE-grade scientific terminology>",
  "image_prompt": "<the exact prompt you want passed to the image model — see rules below>"
}
`;

const EXPLAIN_SYSTEM_PROMPT = `You are a senior UK GCSE science examiner and lesson designer.
Your job is to produce a single, deep, visual-explanation package for ONE topic.

${EXPLAIN_SCHEMA_DESC}

RULES for the eight explanation fields:
- Use AQA-style GCSE terminology by default.
- Use plain student-friendly English in step_by_step.
- key_parts: at least 4, at most 10 labelled items. Each label must be a single
  scientific noun or two-word phrase (e.g. "Cornea", "Optic nerve").
- common_mistake must name the wrong answer students give (e.g. "saying the
  pupil focuses light instead of the lens").
- exam_tip must reference the language that wins the mark (e.g. "use the word
  'refraction' and name BOTH the cornea AND the lens").
- exam_question must include explicit mark allocation in brackets e.g. (4 marks).
- model_answer must score full marks against that allocation, with proper
  examiner phrasing.

RULES for the image_prompt field — this is critical, the image model will follow your prompt literally:
- Describe a CLEAN GCSE-style educational diagram on a WHITE background.
- Specify "labelled diagram", "large readable sans-serif text", "clear
  black arrows pointing to each labelled part", "no decoration", "no shading
  beyond what's needed", "exam textbook style".
- List EVERY label name to be drawn (must match key_parts exactly).
- Forbid clutter, branding, watermarks, photographic realism, comic style.
- Aim for the look of a clean AQA / Edexcel / OCR revision-guide diagram.
- Maximum two sentences — concise, declarative, label-led.

Return JSON only. No prose, no markdown fences.
`;

const REQUIRED_EXPLANATION_FIELDS = [
  "what_image_shows",
  "key_parts",
  "step_by_step",
  "why_it_matters_gcse",
  "common_mistake",
  "exam_tip",
  "exam_question",
  "model_answer",
  "image_prompt",
];

const JSON_OBJECT_RE = /\{[\s\S]*\}/;

function extractJsonObject(text) {
  if (!text || !String(text).trim()) {
    throw new ValueError("Empty LLM response");
  }
  const match = String(text).match(JSON_OBJECT_RE);
  if (!match) {
    throw new ValueError("No JSON object found in LLM response");
  }
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    throw new ValueError(`LLM returned invalid JSON: ${e.message}`);
  }
}

class ValueError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValueError";
  }
}

function validateExplanation(data) {
  const missing = REQUIRED_EXPLANATION_FIELDS.filter((k) => !data[k]);
  if (missing.length) {
    throw new ValueError(`Explanation missing required fields: ${missing.join(", ")}`);
  }
  if (!Array.isArray(data.key_parts) || data.key_parts.length < 3) {
    throw new ValueError("key_parts must have at least 3 labelled items");
  }
  return data;
}

async function generateExplanationAndPrompt({
  topic,
  subject = "GCSE Biology",
  examBoard = "AQA",
  tier = "Higher",
  context = null,
}) {
  const ctxBlock = context ? `\nExtra context from the lesson: ${context}\n` : "";
  const user = [
    "Generate the GCSE visual-explanation JSON for this topic.",
    `Topic: ${topic}`,
    `Subject: ${subject}`,
    `Exam board: ${examBoard}`,
    `Tier: ${tier}${ctxBlock}`,
    "Return JSON only.",
  ].join("\n");

  const raw = await callOpenAiJson({
    system: EXPLAIN_SYSTEM_PROMPT,
    user,
    temperature: 0.25,
  });
  return validateExplanation(raw);
}

/**
 * Best-effort image generation. Returns { data_url, mime_type } or null.
 * Never throws.
 */
async function generateImageFromPrompt(imagePrompt) {
  if (process.env.DISABLE_OPENAI === "1") {
    return null;
  }
  const prompt = String(imagePrompt || "").trim();
  if (prompt.length < 10) {
    return null;
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
    if (!apiKey || !String(apiKey).trim()) {
      return null;
    }

    const imageRef = await callOpenAIImages(prompt);
    if (String(imageRef).startsWith("data:image/")) {
      const mime = imageRef.slice(5, imageRef.indexOf(";")) || "image/png";
      return { data_url: imageRef, mime_type: mime };
    }

    const resp = await axios.get(imageRef, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024,
    });
    const buffer = Buffer.from(resp.data);
    const b64 = buffer.toString("base64");
    const mime = "image/png";
    return { data_url: `data:${mime};base64,${b64}`, mime_type: mime };
  } catch (_e) {
    return null;
  }
}

/**
 * @returns {Promise<{ explanation: object, image: object|null, providerStatus: string }>}
 */
async function buildVisualExplanation({
  topic,
  subject = "GCSE Biology",
  examBoard = "AQA",
  tier = "Higher",
  context = null,
}) {
  const explanation = await generateExplanationAndPrompt({
    topic,
    subject,
    examBoard,
    tier,
    context,
  });

  const { finalImagePrompt } = buildFinalImagePrompt({
    topic,
    context,
    subject,
    examBoard,
    tier,
    llmImagePrompt: explanation.image_prompt,
  });

  const image = await generateImageFromPrompt(finalImagePrompt);
  const providerStatus = image ? "image_generated" : "image_provider_unavailable";
  return { explanation, image, providerStatus };
}

module.exports = {
  EXPLAIN_SCHEMA_DESC,
  EXPLAIN_SYSTEM_PROMPT,
  REQUIRED_EXPLANATION_FIELDS,
  extractJsonObject,
  validateExplanation,
  generateExplanationAndPrompt,
  generateImageFromPrompt,
  buildVisualExplanation,
  buildFinalImagePrompt,
  ValueError,
};
