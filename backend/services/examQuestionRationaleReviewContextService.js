/**
 * V2.3B1: read-only review context for one Composite MCQ part + latest candidate.
 * Never writes ExamQuestion, Lesson, or ExamQuestionRationaleCandidate.
 * Never calls an LLM.
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
} = require("../config/mcqRationaleBackfillFlags");
const {
  CandidateServiceError,
  resolveImageContext,
  buildSourceSnapshot,
  toCandidateDto,
  findExactMcqPart,
  isCompositeQuestion,
} = require("./examQuestionRationaleCandidateService");

const ALLOWED_QUERY_KEYS = new Set(["questionId", "partLabel"]);
const MAX_PART_LABEL = 32;

function parseReviewQuery(query) {
  if (query == null || typeof query !== "object" || Array.isArray(query)) {
    throw new CandidateServiceError(400, "INVALID_QUERY", "Query must be an object");
  }

  const keys = Object.keys(query);
  for (const k of keys) {
    if (!ALLOWED_QUERY_KEYS.has(k)) {
      throw new CandidateServiceError(400, "UNEXPECTED_QUERY_PARAM", `Unexpected query parameter: ${k}`);
    }
  }

  const questionId = query.questionId;
  const partLabel = query.partLabel;

  if (typeof questionId !== "string" || !mongoose.Types.ObjectId.isValid(questionId)) {
    throw new CandidateServiceError(400, "INVALID_QUESTION_ID", "Valid questionId required");
  }
  if (typeof partLabel !== "string" || Array.isArray(partLabel)) {
    throw new CandidateServiceError(400, "INVALID_PART_LABEL", "partLabel must be a scalar string");
  }
  const normalizedLabel = normalizeText(partLabel);
  if (!normalizedLabel || normalizedLabel.length > MAX_PART_LABEL) {
    throw new CandidateServiceError(400, "INVALID_PART_LABEL", "partLabel must be a short string");
  }

  return {
    questionId: String(questionId),
    partLabel: normalizedLabel,
  };
}

function hasTaxonomyContext(question) {
  const subject = normalizeText(question.subject);
  const topic = normalizeText(question.topic);
  const topicKey = normalizeText(question.topicKey);
  return Boolean(subject) && (Boolean(topic) || Boolean(topicKey));
}

function mapStructureRejectCode(structureReason) {
  switch (structureReason) {
    case "correct_index_invalid":
      return "INVALID_CORRECT_INDEX";
    case "question_text_missing":
      return "MISSING_QUESTION_TEXT";
    case "options_not_array":
    case "options_insufficient":
      return "MALFORMED_OPTIONS";
    default:
      return "PART_MALFORMED";
  }
}

async function findLatestCandidate(questionId, partLabel) {
  return ExamQuestionRationaleCandidate.findOne({
    questionId,
    partLabel,
  })
    .sort({ generatedAt: -1 })
    .lean();
}

async function findActiveBlockingCandidate(questionId, partLabel) {
  return ExamQuestionRationaleCandidate.findOne({
    questionId,
    partLabel,
    active: true,
    status: { $in: ["generating", "pending"] },
  })
    .select({ _id: 1, status: 1 })
    .lean();
}

/**
 * @param {{ query: object }} args
 */
async function getRationaleReviewContext({ query }) {
  const req = parseReviewQuery(query);

  const question = await ExamQuestion.findById(req.questionId).lean();
  if (!question) {
    throw new CandidateServiceError(404, "QUESTION_NOT_FOUND", "Exam question not found");
  }
  if (question.isArchived) {
    throw new CandidateServiceError(409, "QUESTION_ARCHIVED", "Archived questions are not available for review");
  }
  if (!isCompositeQuestion(question)) {
    throw new CandidateServiceError(400, "NOT_COMPOSITE", "Only composite exam questions are supported");
  }

  const part = findExactMcqPart(question, req.partLabel);

  const classification = classifyCompositeMcqPart(part, {
    isArchived: question.isArchived,
    subject: question.subject,
    topic: question.topic,
    topicKey: question.topicKey,
  });

  if (classification.structureReason) {
    throw new CandidateServiceError(
      409,
      mapStructureRejectCode(classification.structureReason),
      "MCQ part is not structurally valid for review",
      { structureReason: classification.structureReason, bucket: classification.bucket }
    );
  }

  if (!hasTaxonomyContext(question)) {
    throw new CandidateServiceError(
      409,
      "MISSING_TAXONOMY_CONTEXT",
      "Subject and topic (or topicKey) are required for review"
    );
  }

  const imageCtx = resolveImageContext(question);
  const imageContextRequired = !imageCtx.ok;
  const imageContextAvailable = Boolean(imageCtx.ok && normalizeText(imageCtx.imageContextText));
  const imageContextText = imageCtx.ok ? String(imageCtx.imageContextText || "") : "";
  // Bounded diagnostic only — never URLs / mediaIds / filenames / tokens.
  const mediaContext = imageCtx.mediaContext || {
    referencePresent: Boolean(imageContextRequired || imageContextAvailable),
    scope: imageContextRequired || imageContextAvailable ? "question_shared" : "none",
    trustedContextAvailable: Boolean(imageContextAvailable),
  };

  const sourceSnapshot = buildSourceSnapshot(
    question,
    part,
    classification,
    imageCtx.ok ? imageCtx.imageContextText : ""
  );

  const currentSourceFingerprint = computeMcqRationaleSourceFingerprint({
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

  const latestDoc = await findLatestCandidate(req.questionId, req.partLabel);
  const latestCandidate = latestDoc ? toCandidateDto(latestDoc) : null;
  const candidateIsStale = Boolean(
    latestCandidate && latestCandidate.sourceFingerprint !== currentSourceFingerprint
  );

  const generationFeatureEnabled = isMcqRationaleBackfillV23aEnabled();
  const publishedGenerationEnabled = isMcqRationaleBackfillPublishedAllowed();

  const questionStatus = String(question.status || "").toLowerCase();
  let canGenerate = false;
  let canGenerateReason = "";

  if (questionStatus === "published" && !publishedGenerationEnabled) {
    canGenerate = false;
    canGenerateReason = "PUBLISHED_NOT_ENABLED";
  } else if (questionStatus !== "draft") {
    canGenerate = false;
    canGenerateReason = "STATUS_NOT_ALLOWED";
  } else if (!classification.potentiallyEligibleForBackfill) {
    canGenerate = false;
    canGenerateReason =
      classification.bucket === "substantive" ? "RATIONALE_SUBSTANTIVE" : "NOT_ELIGIBLE";
  } else if (imageContextRequired) {
    canGenerate = false;
    canGenerateReason = "IMAGE_CONTEXT_REQUIRED";
  } else {
    const blocking = await findActiveBlockingCandidate(req.questionId, req.partLabel);
    if (blocking) {
      canGenerate = false;
      canGenerateReason = "ACTIVE_CANDIDATE_EXISTS";
    } else {
      canGenerate = true;
      canGenerateReason = "";
    }
  }

  const options = (classification.options || []).map((text, index) => ({
    index,
    text: String(text),
    isCorrect: classification.correctIndex === index,
  }));

  return {
    questionId: req.questionId,
    partLabel: req.partLabel,
    taxonomy: {
      subject: String(question.subject || ""),
      examBoard: String(question.examBoard || ""),
      level: String(question.level || ""),
      tier: "",
      topic: String(question.topic || ""),
      topicKey: String(question.topicKey || ""),
    },
    questionStatus: String(question.status || ""),
    sharedStem: String(question.sharedStem || ""),
    questionText: String(classification.questionText || part.questionText || ""),
    options,
    correctIndex: classification.correctIndex,
    correctOption: classification.correctOption,
    marks: part.marks == null ? null : Number(part.marks),
    markScheme: Array.isArray(part.markScheme) ? part.markScheme.map(String) : [],
    currentRationale:
      classification.explanation == null || classification.explanation === undefined
        ? null
        : String(classification.explanation),
    rationaleBucket: classification.bucket,
    potentiallyEligibleForBackfill: Boolean(classification.potentiallyEligibleForBackfill),
    currentSourceFingerprint,
    sourceUpdatedAt: question.updatedAt ? new Date(question.updatedAt).toISOString() : null,
    imageContextAvailable,
    imageContextRequired,
    imageContextText: imageContextText || undefined,
    mediaContext: {
      referencePresent: Boolean(mediaContext.referencePresent),
      scope: mediaContext.scope === "question_shared" ? "question_shared" : "none",
      trustedContextAvailable: Boolean(mediaContext.trustedContextAvailable),
    },
    generationFeatureEnabled,
    publishedGenerationEnabled,
    canGenerate,
    canGenerateReason,
    latestCandidate,
    candidateIsStale,
    readOnly: true,
  };
}

module.exports = {
  getRationaleReviewContext,
  parseReviewQuery,
  ALLOWED_QUERY_KEYS,
  CandidateServiceError,
};
