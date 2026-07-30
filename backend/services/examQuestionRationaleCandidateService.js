/**
 * V2.3A: generate and persist an ExamQuestion rationale candidate.
 * Read-only on ExamQuestion / Lesson. Writes only ExamQuestionRationaleCandidate.
 */
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const ExamQuestionRationaleCandidate = require("../models/ExamQuestionRationaleCandidate");
const { classifyCompositeMcqPart } = require("../utils/classifyMcqRationaleInventory");
const { validateMcqExplanation } = require("../utils/validateMcqExplanation");
const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const {
  isMcqRationaleBackfillV23aEnabled,
  isMcqRationaleBackfillPublishedAllowed,
  getMcqRationaleBackfillActorDailyCap,
  getMcqRationaleBackfillGlobalDailyCap,
} = require("../config/mcqRationaleBackfillFlags");
const {
  computeMcqRationaleSourceFingerprint,
  buildGenerationGroupKey,
  normalizeText,
} = require("../utils/mcqRationaleSourceFingerprint");
const {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildGenerationUserPrompt,
  buildRepairUserPrompt,
} = require("../utils/mcqRationaleCandidatePrompt");

const ALLOWED_BODY_KEYS = new Set([
  "questionId",
  "partLabel",
  "idempotencyKey",
  "expectedSourceFingerprint",
]);

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const FINGERPRINT_RE = /^[a-f0-9]{64}$/i;
const LLM_TIMEOUT_MS = 60_000;
const MIN_IMAGE_CONTEXT_CHARS = 20;

class CandidateServiceError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "CandidateServiceError";
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

function actorObjectId(actorId) {
  return new mongoose.Types.ObjectId(String(actorId));
}

function utcDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error("LLM_TIMEOUT");
      err.code = "LLM_TIMEOUT";
      reject(err);
    }, ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

function parseRequestBody(body) {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    throw new CandidateServiceError(400, "INVALID_BODY", "Request body must be a JSON object");
  }
  const keys = Object.keys(body);
  for (const k of keys) {
    if (!ALLOWED_BODY_KEYS.has(k)) {
      throw new CandidateServiceError(400, "UNEXPECTED_FIELD", `Unexpected field: ${k}`);
    }
  }
  const questionId = body.questionId;
  const partLabel = body.partLabel;
  const idempotencyKey = body.idempotencyKey;
  const expectedSourceFingerprint =
    body.expectedSourceFingerprint == null || body.expectedSourceFingerprint === ""
      ? null
      : String(body.expectedSourceFingerprint).trim();

  if (typeof questionId !== "string" || !mongoose.Types.ObjectId.isValid(questionId)) {
    throw new CandidateServiceError(400, "INVALID_QUESTION_ID", "Valid questionId required");
  }
  if (typeof partLabel !== "string" || !normalizeText(partLabel) || partLabel.length > 32) {
    throw new CandidateServiceError(400, "INVALID_PART_LABEL", "partLabel must be a short string");
  }
  if (typeof idempotencyKey !== "string" || !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    throw new CandidateServiceError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "idempotencyKey must be 8–128 chars of [A-Za-z0-9._:-] starting alphanumeric"
    );
  }
  if (expectedSourceFingerprint && !FINGERPRINT_RE.test(expectedSourceFingerprint)) {
    throw new CandidateServiceError(400, "INVALID_FINGERPRINT", "expectedSourceFingerprint must be SHA-256 hex");
  }

  return {
    questionId: String(questionId),
    partLabel: normalizeText(partLabel),
    idempotencyKey: String(idempotencyKey),
    expectedSourceFingerprint: expectedSourceFingerprint
      ? expectedSourceFingerprint.toLowerCase()
      : null,
  };
}

/**
 * Resolve textual image context. Rejects image-dependent questions without adequate text.
 */
function resolveImageContext(question) {
  const imageUrl = normalizeText(question.imageUrl);
  const assets = Array.isArray(question.assets) ? question.assets : [];
  const imageAssets = assets.filter((a) => {
    if (!a || typeof a !== "object") return false;
    const type = normalizeText(a.type).toLowerCase() || "image";
    const isImageType = ["image", "diagram", "graph", "figure", "table"].includes(type);
    return isImageType || Boolean(normalizeText(a.url)) || Boolean(a.mediaId);
  });
  const dependsOnImage = Boolean(imageUrl) || imageAssets.length > 0;
  if (!dependsOnImage) {
    return { ok: true, imageContextText: "" };
  }

  const altParts = [];
  for (const a of imageAssets) {
    const alt = normalizeText(a.alt);
    if (alt) altParts.push(alt);
  }
  const imageContextText = altParts.join("\n").trim();
  // Never use URL/filename as description.
  if (imageContextText.length < MIN_IMAGE_CONTEXT_CHARS) {
    return { ok: false, code: "IMAGE_CONTEXT_REQUIRED", imageContextText: "" };
  }
  return { ok: true, imageContextText };
}

function isCompositeQuestion(question) {
  return question.type === "composite" || question.questionMode === "composite";
}

function findExactMcqPart(question, partLabel) {
  const parts = Array.isArray(question.parts) ? question.parts : [];
  const matches = parts.filter((p) => p && normalizeText(p.label) === partLabel);
  if (matches.length === 0) {
    throw new CandidateServiceError(404, "PART_NOT_FOUND", "No matching MCQ part for partLabel");
  }
  if (matches.length > 1) {
    throw new CandidateServiceError(409, "DUPLICATE_PART_LABEL", "Duplicate part labels are not allowed");
  }
  const part = matches[0];
  if (String(part.type || "").toLowerCase() !== "mcq") {
    throw new CandidateServiceError(400, "WRONG_PART_TYPE", "Part type must be mcq");
  }
  return part;
}

function buildSourceSnapshot(question, part, classification, imageContextText) {
  const options = classification.options || [];
  const correctIndex = classification.correctIndex;
  const correctOption =
    correctIndex != null && options[correctIndex] != null ? String(options[correctIndex]) : "";
  const currentExplanation =
    classification.explanation == null ? "" : String(classification.explanation);

  return {
    subject: String(question.subject || ""),
    examBoard: String(question.examBoard || ""),
    level: String(question.level || ""),
    tier: "",
    topic: String(question.topic || ""),
    topicKey: String(question.topicKey || ""),
    questionStatus: String(question.status || ""),
    sharedStem: String(question.sharedStem || ""),
    questionText: String(classification.questionText || part.questionText || ""),
    options,
    correctIndex,
    correctOption,
    marks: part.marks == null ? null : Number(part.marks),
    markScheme: Array.isArray(part.markScheme) ? part.markScheme.map(String) : [],
    imageContextText: String(imageContextText || ""),
    currentExplanation,
  };
}

function toCandidateDto(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    candidateId: String(o._id),
    questionId: String(o.questionId),
    partLabel: o.partLabel,
    status: o.status,
    attemptNumber: o.attemptNumber,
    sourceFingerprint: o.sourceFingerprint,
    sourceUpdatedAt: o.sourceUpdatedAt ? new Date(o.sourceUpdatedAt).toISOString() : null,
    sourceSnapshot: o.sourceSnapshot,
    explanation: o.explanation || "",
    promptVersion: o.promptVersion || "",
    model: o.model || "",
    generatedAt: o.generatedAt ? new Date(o.generatedAt).toISOString() : null,
    completedAt: o.completedAt ? new Date(o.completedAt).toISOString() : null,
    validationIssueCodes: Array.isArray(o.validationIssueCodes) ? o.validationIssueCodes : [],
    failureCode: o.failureCode || "",
  };
}

function requestScopeKey(questionId, partLabel, sourceFingerprint) {
  return `${questionId}|${partLabel}|${sourceFingerprint}`;
}

async function findExistingIdempotent(actorId, idempotencyKey) {
  return ExamQuestionRationaleCandidate.findOne({
    generatedBy: actorObjectId(actorId),
    idempotencyKey,
  });
}

async function assertDailyCaps(actorId) {
  const { start, end } = utcDayBounds();
  const actorCount = await ExamQuestionRationaleCandidate.countDocuments({
    generatedBy: actorObjectId(actorId),
    generatedAt: { $gte: start, $lt: end },
  });
  const actorCap = getMcqRationaleBackfillActorDailyCap();
  if (actorCount >= actorCap) {
    throw new CandidateServiceError(429, "ACTOR_DAILY_CAP", "Daily candidate generation cap reached for this user", {
      actorCount,
      actorCap,
    });
  }

  const globalCount = await ExamQuestionRationaleCandidate.countDocuments({
    generatedAt: { $gte: start, $lt: end },
  });
  const globalCap = getMcqRationaleBackfillGlobalDailyCap();
  if (globalCount >= globalCap) {
    throw new CandidateServiceError(429, "GLOBAL_DAILY_CAP", "Global daily candidate generation cap reached", {
      globalCount,
      globalCap,
    });
  }

  // Honest note: a small race remains between this check and insert without an atomic ledger.
  return { actorCount, globalCount, actorCap, globalCap };
}

async function assertNoActiveGeneratingForActor(actorId) {
  const existing = await ExamQuestionRationaleCandidate.findOne({
    generatedBy: actorObjectId(actorId),
    status: "generating",
    active: true,
  }).select("_id");
  if (existing) {
    throw new CandidateServiceError(
      409,
      "ACTOR_GENERATION_IN_PROGRESS",
      "Another candidate generation is already in progress for this user"
    );
  }
}

async function markCandidateFailed(candidate, failureCode, validationIssueCodes = []) {
  candidate.status = "failed";
  candidate.active = false;
  candidate.failureCode = failureCode;
  candidate.validationIssueCodes = validationIssueCodes.slice(0, 40);
  candidate.completedAt = new Date();
  candidate.explanation = "";
  await candidate.save();
  return candidate;
}

function extractExplanation(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  if (typeof parsed.explanation !== "string") return null;
  return parsed.explanation;
}

/**
 * @param {{ actorId: string, body: object, llmCall?: Function }} args
 */
async function createRationaleCandidate({ actorId, body, llmCall = callOpenAiJson }) {
  if (!isMcqRationaleBackfillV23aEnabled()) {
    throw new CandidateServiceError(404, "FEATURE_DISABLED", "MCQ rationale backfill V2.3A is not enabled on this server");
  }

  const req = parseRequestBody(body);

  // Read-only ExamQuestion load — never trust inventory/client educational fields
  const question = await ExamQuestion.findById(req.questionId).lean();
  if (!question) {
    throw new CandidateServiceError(404, "QUESTION_NOT_FOUND", "Exam question not found");
  }
  if (question.isArchived) {
    throw new CandidateServiceError(409, "QUESTION_ARCHIVED", "Archived questions are not eligible");
  }
  if (!isCompositeQuestion(question)) {
    throw new CandidateServiceError(400, "NOT_COMPOSITE", "Only composite exam questions are supported");
  }

  const status = String(question.status || "").toLowerCase();
  if (status === "published" && !isMcqRationaleBackfillPublishedAllowed()) {
    throw new CandidateServiceError(
      403,
      "PUBLISHED_NOT_ENABLED",
      "Published-question candidate generation is not enabled"
    );
  }
  if (status !== "draft" && status !== "published") {
    throw new CandidateServiceError(409, "STATUS_NOT_ALLOWED", "Question status is not allowed");
  }

  const part = findExactMcqPart(question, req.partLabel);
  const classification = classifyCompositeMcqPart(part, {
    isArchived: question.isArchived,
    subject: question.subject,
    topic: question.topic,
    topicKey: question.topicKey,
  });

  if (!classification.potentiallyEligibleForBackfill) {
    const code =
      classification.bucket === "substantive"
        ? "RATIONALE_SUBSTANTIVE"
        : classification.bucket === "malformed"
          ? "PART_MALFORMED"
          : "NOT_ELIGIBLE";
    throw new CandidateServiceError(409, code, "Part is not eligible for rationale candidate generation", {
      bucket: classification.bucket,
      structureReason: classification.structureReason || null,
    });
  }

  const imageCtx = resolveImageContext(question);
  if (!imageCtx.ok) {
    throw new CandidateServiceError(422, imageCtx.code, "Image-dependent question lacks safe textual image context");
  }

  const sourceSnapshot = buildSourceSnapshot(question, part, classification, imageCtx.imageContextText);
  const sourceFingerprint = computeMcqRationaleSourceFingerprint({
    questionId: req.questionId,
    partLabel: req.partLabel,
    sharedStem: sourceSnapshot.sharedStem,
    questionText: sourceSnapshot.questionText,
    options: sourceSnapshot.options,
    correctIndex: sourceSnapshot.correctIndex,
    marks: sourceSnapshot.marks,
    markScheme: sourceSnapshot.markScheme,
    subject: sourceSnapshot.subject,
    examBoard: sourceSnapshot.examBoard,
    level: sourceSnapshot.level,
    tier: sourceSnapshot.tier,
    topic: sourceSnapshot.topic,
    topicKey: sourceSnapshot.topicKey,
    imageContextText: sourceSnapshot.imageContextText,
    currentExplanation: sourceSnapshot.currentExplanation,
  });

  if (req.expectedSourceFingerprint && req.expectedSourceFingerprint !== sourceFingerprint) {
    throw new CandidateServiceError(409, "STALE_SOURCE_FINGERPRINT", "Source fingerprint does not match current question");
  }

  const existingIdem = await findExistingIdempotent(actorId, req.idempotencyKey);
  if (existingIdem) {
    if (
      String(existingIdem.questionId) !== req.questionId ||
      existingIdem.partLabel !== req.partLabel ||
      existingIdem.sourceFingerprint !== sourceFingerprint
    ) {
      throw new CandidateServiceError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "idempotencyKey was already used for a different source request"
      );
    }
    return { dto: toCandidateDto(existingIdem), replayed: true };
  }

  await assertDailyCaps(actorId);
  await assertNoActiveGeneratingForActor(actorId);

  const generationGroupKey = buildGenerationGroupKey(req.questionId, req.partLabel, sourceFingerprint);
  const modelName = process.env.LLM_MODEL || "gpt-4o-mini";

  let candidate;
  try {
    candidate = await ExamQuestionRationaleCandidate.create({
      questionId: req.questionId,
      partLabel: req.partLabel,
      sourceFingerprint,
      sourceUpdatedAt: question.updatedAt || null,
      sourceSnapshot,
      priorExplanation: sourceSnapshot.currentExplanation || "",
      explanation: "",
      status: "generating",
      active: true,
      attemptNumber: 1,
      generationGroupKey,
      idempotencyKey: req.idempotencyKey,
      promptVersion: PROMPT_VERSION,
      model: modelName,
      generatedBy: actorObjectId(actorId),
      generatedAt: new Date(),
      completedAt: null,
      failureCode: "",
      validationIssueCodes: [],
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const raced = await findExistingIdempotent(actorId, req.idempotencyKey);
      if (
        raced &&
        String(raced.questionId) === req.questionId &&
        raced.partLabel === req.partLabel &&
        raced.sourceFingerprint === sourceFingerprint
      ) {
        return { dto: toCandidateDto(raced), replayed: true };
      }
      const active = await ExamQuestionRationaleCandidate.findOne({
        questionId: req.questionId,
        partLabel: req.partLabel,
        sourceFingerprint,
        active: true,
      });
      if (active) {
        throw new CandidateServiceError(
          409,
          "ACTIVE_CANDIDATE_EXISTS",
          "An active candidate already exists for this question part and fingerprint"
        );
      }
      throw new CandidateServiceError(409, "DUPLICATE_RESERVATION", "Could not reserve candidate (duplicate key)");
    }
    throw err;
  }

  let llmCalls = 0;
  try {
    const firstParsed = await withTimeout(
      llmCall({
        system: SYSTEM_PROMPT,
        user: buildGenerationUserPrompt(sourceSnapshot),
        temperature: 0.2,
      }),
      LLM_TIMEOUT_MS
    );
    llmCalls += 1;

    let explanation = extractExplanation(firstParsed);
    let validated = explanation != null
      ? validateMcqExplanation(explanation, { correctOption: sourceSnapshot.correctOption })
      : { ok: false, issues: ["explanation_missing"] };

    if (!validated.ok) {
      const repairParsed = await withTimeout(
        llmCall({
          system: SYSTEM_PROMPT,
          user: buildRepairUserPrompt(
            sourceSnapshot,
            explanation == null ? "" : explanation,
            validated.issues || []
          ),
          temperature: 0.2,
        }),
        LLM_TIMEOUT_MS
      );
      llmCalls += 1;
      explanation = extractExplanation(repairParsed);
      validated = explanation != null
        ? validateMcqExplanation(explanation, { correctOption: sourceSnapshot.correctOption })
        : { ok: false, issues: ["explanation_missing"] };

      if (!validated.ok) {
        await markCandidateFailed(candidate, "VALIDATION_FAILED", validated.issues || []);
        throw new CandidateServiceError(422, "VALIDATION_FAILED", "Generated rationale failed validation", {
          candidate: toCandidateDto(candidate),
          validationIssueCodes: validated.issues || [],
          llmCalls,
        });
      }
    }

    candidate.explanation = validated.explanation;
    candidate.status = "pending";
    candidate.active = true;
    candidate.completedAt = new Date();
    candidate.promptVersion = PROMPT_VERSION;
    candidate.model = modelName;
    candidate.failureCode = "";
    candidate.validationIssueCodes = [];
    await candidate.save();

    return { dto: toCandidateDto(candidate), replayed: false, llmCalls };
  } catch (err) {
    if (err instanceof CandidateServiceError && err.code === "VALIDATION_FAILED") {
      throw err;
    }

    let failureCode = "LLM_ERROR";
    if (err && err.code === "LLM_TIMEOUT") failureCode = "LLM_TIMEOUT";
    else if (err && err.code === "LLM_BAD_JSON") failureCode = "LLM_BAD_JSON";
    else if (err && err.code === "LLM_EMPTY") failureCode = "LLM_EMPTY";
    else if (err && err.code === "LLM_NOT_CONFIGURED") failureCode = "LLM_NOT_CONFIGURED";

    try {
      // Reload in case validation path already marked failed
      const fresh = await ExamQuestionRationaleCandidate.findById(candidate._id);
      if (fresh && fresh.status === "generating" && fresh.active) {
        await markCandidateFailed(fresh, failureCode, []);
        candidate = fresh;
      }
    } catch (_) {
      // ignore secondary failure
    }

    throw new CandidateServiceError(503, failureCode, "Rationale generation failed", {
      candidate: candidate ? toCandidateDto(candidate) : null,
      llmCalls,
    });
  }
}

module.exports = {
  CandidateServiceError,
  createRationaleCandidate,
  parseRequestBody,
  resolveImageContext,
  buildSourceSnapshot,
  toCandidateDto,
  requestScopeKey,
  utcDayBounds,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  ALLOWED_BODY_KEYS,
  IDEMPOTENCY_KEY_RE,
  MIN_IMAGE_CONTEXT_CHARS,
};
