// backend/services/generateRevision.js — Phase 9E + 9F
// Phase 9E: Kill-switch DISABLE_AI_REVISION_GENERATION dominates.
// Phase 9F: Slot engine with telemetry, REVISION_NO_FALLBACK, output validation, minimal child env.

const path = require("path");
const { spawnSync } = require("child_process");

/** Phase 9E kill-switch (dominates). */
function isRevisionGenerationDisabled() {
  return process.env.DISABLE_AI_REVISION_GENERATION === "1";
}

/** Deterministic bucket 0..99 from jobId (match script). */
function rolloutBucket(jobId) {
  let h = 0;
  const s = String(jobId ?? "");
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 100;
}

/** Build slot-generation.v1 job spec for a lesson (revision kind). */
function buildRevisionJobSpec(lesson) {
  const lessonId = (lesson._id || lesson.id || "").toString();
  const jobId = lessonId || `rev_${Date.now()}`;
  const pages = lesson.pages || [];
  const input = {
    lessonId,
    title: lesson.title || "",
    subject: lesson.subject || "",
    level: lesson.level || "",
    board: lesson.board || "",
    topic: lesson.topic || "",
    pages: pages.map((p) => ({
      pageId: p.pageId,
      title: p.title,
      order: p.order,
      blocks: (p.blocks || []).map((b) => ({ type: b.type, content: b.content || "" })),
    })),
  };

  return {
    version: "v1",
    appliesTo: {
      subject: input.subject || "Biology",
      level: input.level || "GCSE",
      board: input.board || "",
      specVersion: "v1",
      topic: input.topic || "",
    },
    jobs: [
      {
        jobId,
        slotId: "revision",
        kind: "revision",
        mode: "generate",
        input,
        output: { field: "revision", type: "flashcards+quiz" },
        sources: [],
        required: true,
      },
    ],
    metadata: { requiresReview: true, allowAI: true },
  };
}

/** Minimal env for child (no full process.env pass-through). */
function buildSlotEngineEnv() {
  const base = {
    PATH: process.env.PATH || "",
    NODE_ENV: process.env.NODE_ENV || "development",
    FEATURE_SLOTGEN_AI: "true",
  };
  if (process.env.SLOTGEN_AI_KILL !== undefined) base.SLOTGEN_AI_KILL = process.env.SLOTGEN_AI_KILL;
  if (process.env.SLOTGEN_AI_ROLLOUT_PERCENT !== undefined) base.SLOTGEN_AI_ROLLOUT_PERCENT = process.env.SLOTGEN_AI_ROLLOUT_PERCENT;
  if (process.env.SLOTGEN_ALLOWLIST_PATH !== undefined) base.SLOTGEN_ALLOWLIST_PATH = process.env.SLOTGEN_ALLOWLIST_PATH;
  if (process.env.OPENAI_API_KEY !== undefined) base.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (process.env.OPENAI_BASE_URL !== undefined) base.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
  return base;
}

/** Parse last telemetry line from stderr (slot-generation-telemetry.v1). */
function parseTelemetryFromStderr(stderr) {
  if (!stderr || typeof stderr !== "string") return null;
  const lines = stderr.trim().split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj && obj.version === "v1" && obj.jobId != null) return obj;
    } catch {
      // ignore non-JSON lines
    }
  }
  return null;
}

/** Run slot engine. Returns { result, stderr } for telemetry. */
function runSlotEngine(jobSpec) {
  const repoRoot = path.resolve(__dirname, "../..");
  const scriptPath = path.join(repoRoot, "scripts", "run-slot-generation-openai.js");
  const env = buildSlotEngineEnv();

  const spawn = spawnSync("node", [scriptPath], {
    cwd: repoRoot,
    input: JSON.stringify(jobSpec, null, 2),
    encoding: "utf8",
    env,
    maxBuffer: 4 * 1024 * 1024,
  });

  let result = null;
  try {
    if (spawn.stdout) result = JSON.parse(spawn.stdout);
  } catch {
    result = null;
  }

  return { result, stderr: spawn.stderr || "", status: spawn.status };
}

/** Lightweight validation: revision output shape before accepting. */
function validateRevisionOutput(out) {
  if (!out || typeof out !== "object" || Array.isArray(out)) return false;
  if (out.flashcards !== undefined) {
    if (!Array.isArray(out.flashcards)) return false;
    for (const card of out.flashcards) {
      if (!card || typeof card.front !== "string" || typeof card.back !== "string") return false;
    }
  }
  if (out.quiz !== undefined && out.quiz !== null) {
    if (typeof out.quiz !== "object") return false;
    const q = out.quiz;
    if (q.timeSeconds !== undefined && (typeof q.timeSeconds !== "number" || !Number.isFinite(q.timeSeconds))) return false;
    if (q.questions !== undefined) {
      if (!Array.isArray(q.questions)) return false;
      for (const item of q.questions) {
        if (!item || typeof item.question !== "string") return false;
      }
    }
  }
  if (!out.flashcards?.length && !(out.quiz?.questions?.length)) return false;
  return true;
}

/** Heuristic fallback (no OpenAI). */
function heuristicRevision(opts) {
  const lesson = opts?.lesson || {};
  const title = lesson.title || "Revision";
  const textFromFirstPage =
    lesson.pages?.[0]?.blocks
      ?.filter((b) => b && b.content)
      .map((b) => b.content)
      .join(" ") || title;

  const flashcards = [
    {
      id: `fc_${Date.now()}_0`,
      front: `Key concept: ${title}`,
      back: textFromFirstPage.slice(0, 200) || "See lesson content.",
      tags: ["revision"],
      difficulty: 1,
    },
  ];

  const quiz = {
    timeSeconds: 600,
    questions: [
      {
        id: `q_${Date.now()}_0`,
        type: "mcq",
        question: `What is the main topic of "${title}"?`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: "Option A",
        explanation: "",
        tags: [],
        difficulty: 1,
        marks: 1,
      },
    ],
  };

  return { flashcards, quiz };
}

/** Build engine telemetry payload for storage (bounded). */
function sanitizeEngineTelemetry(slotResult, telemetry, jobId, kind) {
  const status = slotResult?.status ?? "UNKNOWN";
  const errCode = telemetry?.errorCode ?? slotResult?.errorCode ?? (slotResult ? null : "PARSE_FAILED");
  const bucket = jobId != null ? rolloutBucket(jobId) : null;
  return {
    status,
    errorCode: errCode,
    jobId: jobId ?? null,
    kind: kind ?? "revision",
    path: telemetry?.path ?? null,
    latencyMs: typeof telemetry?.latencyMs === "number" ? telemetry.latencyMs : null,
    executorVersion: typeof telemetry?.executorVersion === "string" ? telemetry.executorVersion : null,
    rolloutBucket: bucket,
  };
}

/**
 * Generate revision content (flashcards + quiz) for a lesson.
 * Returns { flashcards, quiz, engineTelemetry }.
 * Throws REVISION_ENGINE_UNAVAILABLE when REVISION_NO_FALLBACK=1 and engine returns STUB/fail.
 */
async function generateRevisionForLesson(opts) {
  if (isRevisionGenerationDisabled()) {
    const err = new Error("AI revision generation is disabled");
    err.code = "REVISION_GENERATION_DISABLED";
    throw err;
  }

  const noFallback = process.env.REVISION_NO_FALLBACK === "1";
  const lesson = opts?.lesson || {};
  const jobSpec = buildRevisionJobSpec(lesson);
  const jobId = jobSpec.jobs?.[0]?.jobId ?? "UNKNOWN";
  const kind = jobSpec.jobs?.[0]?.kind ?? "revision";

  let slotResult;
  let stderr = "";
  try {
    const run = runSlotEngine(jobSpec);
    slotResult = run.result;
    stderr = run.stderr || "";
  } catch (e) {
    slotResult = { status: "STUB", errorCode: "ENGINE_SPAWN_FAILED" };
  }
  const telemetry = parseTelemetryFromStderr(stderr);
  const engineTelemetry = sanitizeEngineTelemetry(slotResult, telemetry, jobId, kind);

  if (slotResult && slotResult.status === "COMPLETED" && slotResult.output && typeof slotResult.output === "object") {
    const out = slotResult.output;
    if (validateRevisionOutput(out)) {
      return {
        flashcards: out.flashcards || [],
        quiz: out.quiz || { timeSeconds: 600, questions: [] },
        engineTelemetry: { ...engineTelemetry, status: "COMPLETED", errorCode: null },
      };
    }
    engineTelemetry.errorCode = engineTelemetry.errorCode || "OUTPUT_VALIDATION_FAILED";
    if (noFallback) {
      const err = new Error("Revision engine output failed validation");
      err.code = "REVISION_ENGINE_UNAVAILABLE";
      err.engineErrorCode = engineTelemetry.errorCode;
      err.engineTelemetry = engineTelemetry;
      throw err;
    }
  }

  // STUB or non-completed or invalid output: log once at appropriate level, then fallback or throw
  const logLine = {
    status: slotResult?.status ?? "NO_RESULT",
    errorCode: engineTelemetry.errorCode,
    jobId,
    kind,
    rolloutBucket: engineTelemetry.rolloutBucket,
  };
  const code = engineTelemetry.errorCode;
  if (code === "ENGINE_SPAWN_FAILED") {
    console.error("[revision-engine]", JSON.stringify(logLine));
  } else if (code === "KILL_SWITCH") {
    console.warn("[revision-engine]", JSON.stringify(logLine));
  } else {
    console.info("[revision-engine]", JSON.stringify(logLine));
  }

  if (noFallback) {
    const err = new Error("Revision engine unavailable (STUB or failed)");
    err.code = "REVISION_ENGINE_UNAVAILABLE";
    err.engineErrorCode = engineTelemetry.errorCode;
    err.engineTelemetry = engineTelemetry;
    throw err;
  }

  const heuristic = heuristicRevision(opts);
  return {
    ...heuristic,
    engineTelemetry: { ...engineTelemetry, status: "STUB", source: "heuristic" },
  };
}

module.exports = {
  generateRevisionForLesson,
  buildRevisionJobSpec,
  heuristicRevision,
  validateRevisionOutput,
  rolloutBucket,
};
