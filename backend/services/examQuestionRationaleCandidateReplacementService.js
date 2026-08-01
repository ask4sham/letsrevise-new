/**
 * V2.3B2b2a — create exactly one Attempt 2 replacement Candidate for a rejected Attempt 1.
 * Dedicated endpoint only. Generic create remains blocked for rejected lineages.
 * Never writes ExamQuestion / Lesson. Never sends rejection audit fields to the provider.
 */
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const ExamQuestionRationaleCandidate = require("../models/ExamQuestionRationaleCandidate");
const { classifyCompositeMcqPart } = require("../utils/classifyMcqRationaleInventory");
const {
  computeMcqRationaleSourceFingerprint,
  normalizeText,
} = require("../utils/mcqRationaleSourceFingerprint");
const {
  isMcqRationaleBackfillV23aEnabled,
  isMcqRationaleBackfillPublishedAllowed,
  isMcqRationaleReplacementV23b2b2Enabled,
} = require("../config/mcqRationaleBackfillFlags");
const {
  CandidateServiceError,
  resolveImageContext,
  buildSourceSnapshot,
  toCandidateDto,
  findExactMcqPart,
  isCompositeQuestion,
  findExistingIdempotent,
  assertDailyCaps,
  assertNoActiveGeneratingForActor,
  recoverActiveSourceIfStale,
  newLeaseToken,
  computeLeaseExpiresAt,
  isLeaseExpired,
  expireStaleGeneratingCandidate,
  runGenerationForReservedCandidate,
  IDEMPOTENCY_KEY_RE,
  PROMPT_VERSION,
} = require("./examQuestionRationaleCandidateService");
const {
  assertReplacementEligibility,
  findAttemptTwoForGenerationGroup,
  isValidObjectId,
  normalizePartLabel,
} = require("./examQuestionRationaleCandidateLineageService");
const {
  isMongoAttemptTwoIndexCollision,
} = require("./examQuestionRationaleCandidateAttemptTwoIndex");

const FINGERPRINT_RE = /^[a-f0-9]{64}$/i;
const ALLOWED_REPLACEMENT_BODY_KEYS = new Set([
  "questionId",
  "partLabel",
  "expectedSourceFingerprint",
  "idempotencyKey",
]);

function actorObjectId(actorId) {
  return new mongoose.Types.ObjectId(String(actorId));
}

function parseReplacementBody(body) {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    throw new CandidateServiceError(400, "INVALID_BODY", "Request body must be a JSON object");
  }
  for (const k of Object.keys(body)) {
    if (!ALLOWED_REPLACEMENT_BODY_KEYS.has(k)) {
      throw new CandidateServiceError(400, "UNEXPECTED_FIELD", `Unexpected field: ${k}`);
    }
  }

  const questionId = body.questionId;
  const partLabel = normalizePartLabel(body.partLabel);
  const expectedSourceFingerprint =
    body.expectedSourceFingerprint == null ? "" : String(body.expectedSourceFingerprint).trim().toLowerCase();
  const idempotencyKey = body.idempotencyKey;

  if (!isValidObjectId(questionId)) {
    throw new CandidateServiceError(400, "INVALID_QUESTION_ID", "Valid questionId required");
  }
  if (!expectedSourceFingerprint || !FINGERPRINT_RE.test(expectedSourceFingerprint)) {
    throw new CandidateServiceError(
      400,
      "INVALID_SOURCE_FINGERPRINT",
      "expectedSourceFingerprint must be SHA-256 hex"
    );
  }
  if (typeof idempotencyKey !== "string" || !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    throw new CandidateServiceError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "idempotencyKey must be 8–128 chars of [A-Za-z0-9._:-]"
    );
  }

  return {
    questionId: String(questionId),
    partLabel,
    expectedSourceFingerprint,
    idempotencyKey,
  };
}

function throwAttemptTwoExists(existing) {
  throw new CandidateServiceError(
    409,
    existing && existing.status === "failed" ? "ATTEMPT_LIMIT_REACHED" : "ATTEMPT_2_ALREADY_EXISTS",
    existing && existing.status === "failed"
      ? "The one permitted replacement attempt has already been used"
      : "A replacement candidate already exists for this lineage",
    { candidate: existing ? toCandidateDto(existing) : null }
  );
}

/**
 * @param {{ actorId: string, rejectedCandidateId: string, body: object, llmCall?: Function, now?: Date }} args
 */
async function createReplacementRationaleCandidate({
  actorId,
  rejectedCandidateId,
  body,
  llmCall,
  now: nowArg,
}) {
  const now = nowArg ? new Date(nowArg) : new Date();

  if (!isMcqRationaleBackfillV23aEnabled()) {
    throw new CandidateServiceError(
      404,
      "FEATURE_DISABLED",
      "MCQ rationale backfill V2.3A is not enabled on this server"
    );
  }
  if (!isMcqRationaleReplacementV23b2b2Enabled()) {
    throw new CandidateServiceError(
      404,
      "REPLACEMENT_FEATURE_DISABLED",
      "MCQ rationale replacement generation is not enabled on this server"
    );
  }

  if (!isValidObjectId(rejectedCandidateId)) {
    throw new CandidateServiceError(400, "INVALID_CANDIDATE_ID", "Valid candidateId required");
  }

  const req = parseReplacementBody(body);

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

  // Replacement regenerates for the same source lineage even if EQ rationale bucket changed.
  // Still require structurally valid MCQ part.
  if (classification.structureReason) {
    throw new CandidateServiceError(409, "PART_MALFORMED", "Part is not eligible for rationale candidate generation", {
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

  const rejectedDoc = await ExamQuestionRationaleCandidate.findById(rejectedCandidateId).lean();
  const { generationGroupKey } = assertReplacementEligibility({
    rejectedCandidateId,
    rejectedDoc,
    questionId: req.questionId,
    partLabel: req.partLabel,
    authoritativeSourceFingerprint: sourceFingerprint,
    expectedSourceFingerprint: req.expectedSourceFingerprint,
  });

  const existingIdem = await findExistingIdempotent(actorId, req.idempotencyKey);
  if (existingIdem) {
    if (
      String(existingIdem.questionId) !== req.questionId ||
      existingIdem.partLabel !== req.partLabel ||
      existingIdem.sourceFingerprint !== sourceFingerprint ||
      Number(existingIdem.attemptNumber) !== 2 ||
      String(existingIdem.generationGroupKey) !== generationGroupKey
    ) {
      throw new CandidateServiceError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "idempotencyKey was already used for a different source request"
      );
    }

    if (existingIdem.status === "generating" && existingIdem.active && isLeaseExpired(existingIdem, now)) {
      const expired =
        (await expireStaleGeneratingCandidate(existingIdem._id, now)) ||
        (await ExamQuestionRationaleCandidate.findById(existingIdem._id));
      return { dto: toCandidateDto(expired), replayed: true };
    }

    return { dto: toCandidateDto(existingIdem), replayed: true };
  }

  const existingAttemptTwo = await findAttemptTwoForGenerationGroup(generationGroupKey);
  if (existingAttemptTwo) {
    throwAttemptTwoExists(existingAttemptTwo);
  }

  await assertDailyCaps(actorId);

  const recovery = await recoverActiveSourceIfStale(req.questionId, req.partLabel, sourceFingerprint, now);
  if (recovery.blocking) {
    throw new CandidateServiceError(
      409,
      "ACTIVE_CANDIDATE_EXISTS",
      "An active candidate already exists for this question part and fingerprint",
      { candidate: toCandidateDto(recovery.blocking) }
    );
  }

  await assertNoActiveGeneratingForActor(actorId, now);

  // Re-check Attempt 2 immediately before reservation (race with concurrent replacement).
  const racedAttemptTwo = await findAttemptTwoForGenerationGroup(generationGroupKey);
  if (racedAttemptTwo) {
    throwAttemptTwoExists(racedAttemptTwo);
  }

  const modelName = process.env.LLM_MODEL || "gpt-4o-mini";
  const leaseToken = newLeaseToken();
  const leaseExpiresAt = computeLeaseExpiresAt(now);

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
      attemptNumber: 2,
      generationGroupKey,
      idempotencyKey: req.idempotencyKey,
      promptVersion: PROMPT_VERSION,
      model: modelName,
      generatedBy: actorObjectId(actorId),
      generatedAt: now,
      completedAt: null,
      generationLeaseToken: leaseToken,
      generationLeaseExpiresAt: leaseExpiresAt,
      failureCode: "",
      validationIssueCodes: [],
    });
  } catch (err) {
    if (err && err.code === 11000) {
      // Actor+idempotency unique collision: safe same-key replay when it is Attempt 2 for this lineage.
      const racedIdem = await findExistingIdempotent(actorId, req.idempotencyKey);
      if (racedIdem) {
        if (
          String(racedIdem.questionId) === req.questionId &&
          racedIdem.partLabel === req.partLabel &&
          racedIdem.sourceFingerprint === sourceFingerprint &&
          Number(racedIdem.attemptNumber) === 2 &&
          String(racedIdem.generationGroupKey) === generationGroupKey
        ) {
          return { dto: toCandidateDto(racedIdem), replayed: true };
        }
        throw new CandidateServiceError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "idempotencyKey was already used for a different source request"
        );
      }

      // Attempt-2 unique index collision only — do not treat unrelated 11000 as Attempt-2 races.
      if (isMongoAttemptTwoIndexCollision(err)) {
        const attemptTwo = await findAttemptTwoForGenerationGroup(generationGroupKey);
        if (attemptTwo) {
          throwAttemptTwoExists(attemptTwo);
        }
        throw new CandidateServiceError(
          409,
          "ATTEMPT_2_ALREADY_EXISTS",
          "A replacement candidate already exists for this lineage"
        );
      }

      const again = await recoverActiveSourceIfStale(req.questionId, req.partLabel, sourceFingerprint, new Date());
      if (again.blocking) {
        throw new CandidateServiceError(
          409,
          "ACTIVE_CANDIDATE_EXISTS",
          "An active candidate already exists for this question part and fingerprint",
          { candidate: toCandidateDto(again.blocking) }
        );
      }

      // Visible Attempt 2 without Attempt-2-index metadata is still authoritative for this lineage.
      const existingAttemptTwoAfterRace = await findAttemptTwoForGenerationGroup(generationGroupKey);
      if (existingAttemptTwoAfterRace) {
        throwAttemptTwoExists(existingAttemptTwoAfterRace);
      }

      throw new CandidateServiceError(
        500,
        "UNEXPECTED_DUPLICATE_KEY",
        "Unexpected duplicate-key conflict while reserving replacement candidate"
      );
    }
    throw err;
  }

  return runGenerationForReservedCandidate({
    candidate,
    leaseToken,
    sourceSnapshot,
    modelName,
    llmCall,
    replayed: false,
  });
}

module.exports = {
  createReplacementRationaleCandidate,
  parseReplacementBody,
  ALLOWED_REPLACEMENT_BODY_KEYS,
};
