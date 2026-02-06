// scripts/generate-lesson-bundle.js
// Internal CLI. Not imported by runtime/server.
// Optional OpenAI call; defaults to DRY-RUN mode (no network) unless --openai is used.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "backend", ".env") });

const fs = require("fs");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function nowIso() {
  return new Date().toISOString();
}

function safeJsonFromModelText(text) {
  // Strip ```json fences if present.
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  return JSON.parse(cleaned);
}

function pickTopicFromSeed(seed, { subjectId, levelId, boardId, topicId }) {
  const subject = seed.subjects.find((s) => s.id === subjectId);
  if (!subject) throw new Error(`Subject not found: ${subjectId}`);

  const level = subject.levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`Level not found: ${subjectId}/${levelId}`);

  const board = level.boards.find((b) => b.id === boardId);
  if (!board) throw new Error(`Board not found: ${subjectId}/${levelId}/${boardId}`);

  const topic = board.topics.find((t) => t.id === topicId);
  if (!topic) throw new Error(`Topic not found: ${subjectId}/${levelId}/${boardId}/${topicId}`);

  return { subject, level, board, topic };
}

function buildPrompt({ subject, level, board, topic }) {
  // Keep this short and deterministic; contract/schema do the heavy lifting.
  return [
    "You are generating a Lesson Plan Bundle JSON object.",
    "Return ONLY valid JSON (no markdown, no code fences, no commentary).",
    "",
    "CRITICAL: Output must conform exactly to the schema and field names below.",
    "",
    "Top-level requirements:",
    "- bundleVersion must be exactly \"1.0.0\"",
    "- generatedAt must be an ISO date-time string",
    "- source must be a short string",
    "",
    "Allowed top-level keys ONLY:",
    "- bundleVersion",
    "- generatedAt",
    "- source",
    "- metadata (optional)",
    "- lessons",
    "Do NOT include any other top-level keys (e.g. do NOT include 'curriculum').",
    "",
    "Each lesson object MUST include these required keys (exact names):",
    "- slug (kebab-case, e.g. biology-gcse-aqa-photosynthesis)",
    "- title",
    "- subjectId",
    "- levelId",
    "- boardId",
    "- topicId",
    "- learningObjectives (3 to 7 strings)",
    "- keywords (5 to 50 strings)",
    "- pages (3 to 8 pages)",
    "",
    "Each page MUST include:",
    "- title (string)",
    "- blocks (2 to 8 blocks)",
    "",
    "Lesson requirements:",
    "- isPublished must be false",
    "- isFreePreview must be false",
    "- status must be \"draft\"",
    "",
    "Page/Block structure rules:",
    "- Each lesson must have 3 to 8 pages",
    "- Each page must have 2 to 8 blocks",
    "",
    "Block.type MUST be exactly one of these 6 values (case-sensitive):",
    "- explanation",
    "- workedExample",
    "- diagramDescription",
    "- quizCheckpoint",
    "- summary",
    "- examStylePrompt",
    "",
    "Block fields:",
    "- For type explanation/workedExample/diagramDescription/summary/examStylePrompt: include ONLY { type, content }",
    "- For type quizCheckpoint: include ONLY { type, mcqs }",
    "",
    "IMPORTANT: The array name is mcqs (NOT questions, NOT quiz, NOT items).",
    "",
    "MCQ rules (for each item in mcqs):",
    "- question (string)",
    "- choices (array of exactly 4 strings)",
    "- correctIndex (integer 0..3)",
    "- rationale (string)",
    "- misconceptionDistractors (optional string array)",
    "",
    "If you cannot comply, return a valid JSON object that still matches the schema.",
    "",
    "Curriculum Topic:",
    `- subjectId: ${subject.id} (${subject.name})`,
    `- levelId: ${level.id} (${level.name})`,
    `- boardId: ${board.id} (${board.name})`,
    `- topicId: ${topic.id} (${topic.name})`,
    `- subtopics: ${JSON.stringify(topic.subtopics || [])}`,
    `- examRequirements: ${JSON.stringify(topic.examRequirements || [])}`
  ].join("\n");
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const url = "https://api.openai.com/v1/chat/completions";

  const body = {
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You generate strict JSON only. No markdown. No explanations. Output must be parseable by JSON.parse."
      },
      { role: "user", content: prompt }
    ]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No content returned from OpenAI.");
  return text;
}

function validateWithLocalScript(outFile) {
  const r = spawnSync("node", ["scripts/validate-lesson-bundle.js", outFile], {
    stdio: "inherit"
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function main() {
  // Defaults: biology/gcse/aqa/photosynthesis
  const args = new Map();
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    const next = process.argv[i + 1];
    if (a.startsWith("--")) {
      args.set(a, next && !next.startsWith("--") ? next : true);
    }
  }

  const limitRaw = args.get("--limit");
  const limit =
    limitRaw === undefined
      ? 1
      : Math.max(1, Number.parseInt(String(limitRaw), 10) || 1);

  const mappingPath = path.join(
    "docs",
    "curriculum",
    "mappings",
    "dfe-gcse-biology.map.json"
  );
  const mappingData = loadJson(mappingPath);
  const limitedMappings =
    mappingData && Array.isArray(mappingData.mappings)
      ? mappingData.mappings.slice(0, limit)
      : [];
  const firstMapping = limitedMappings[0] || {};

  const defaultSubjectId = firstMapping.subjectId || "biology";
  const defaultLevelId = firstMapping.levelId || "gcse";
  const defaultBoardId = firstMapping.boardId || "aqa";
  const defaultTopicId = firstMapping.topicId || "photosynthesis";

  const subjectId = args.get("--subject") || defaultSubjectId;
  const levelId = args.get("--level") || defaultLevelId;
  const boardId = args.get("--board") || defaultBoardId;
  const topicId = args.get("--topic") || defaultTopicId;

  const useOpenAI = !!args.get("--openai");
  const outDir =
    args.get("--outDir") ||
    path.join("docs", "ai", "examples");

  const seedPath = path.join(
    "docs",
    "curriculum",
    "seeds",
    "gcse-all-subjects.v1.json"
  );

  const seed = loadJson(seedPath);
  const { subject, level, board, topic } = pickTopicFromSeed(seed, {
    subjectId,
    levelId,
    boardId,
    topicId
  });

  const prompt = buildPrompt({ subject, level, board, topic });

  let bundle;
  if (!useOpenAI) {
    // DRY-RUN mode: copy an existing known-good sample and update timestamps/ids safely.
    const samplePath = path.join(
      "docs",
      "ai",
      "examples",
      "sample-lesson-plan-bundle.v1.json"
    );
    bundle = loadJson(samplePath);
    bundle.generatedAt = nowIso();
    bundle.source = "manual-dry-run";
  } else {
    const text = await callOpenAI(prompt);
    bundle = safeJsonFromModelText(text);
  }

  // Ensure the required invariants even if model tries to violate them:
  bundle.bundleVersion = "1.0.0";
  bundle.generatedAt = bundle.generatedAt || nowIso();
  bundle.source = bundle.source || (useOpenAI ? "openai" : "manual-dry-run");

  if (Array.isArray(bundle.lessons)) {
    for (const l of bundle.lessons) {
      if (typeof l.isPublished === "boolean") l.isPublished = false;
      else l.isPublished = false;
      if (typeof l.isFreePreview === "boolean") l.isFreePreview = false;
      else l.isFreePreview = false;

      // Optional review fields default:
      if (!l.status) l.status = "draft";
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  const stamp = nowIso().replace(/[:.]/g, "-");
  const hash = crypto.randomBytes(3).toString("hex");
  const outFile = path.join(
    outDir,
    `generated-${subjectId}-${levelId}-${boardId}-${topicId}-${stamp}-${hash}.json`
  );

  fs.writeFileSync(outFile, JSON.stringify(bundle, null, 2), "utf8");
  console.log("Wrote:", outFile);

  // Validate via the same validator used elsewhere:
  validateWithLocalScript(outFile);
  console.log("✅ Generated bundle validated successfully.");
}

main().catch((e) => {
  console.error("❌ Generation failed:", e?.message || e);
  process.exit(1);
});

