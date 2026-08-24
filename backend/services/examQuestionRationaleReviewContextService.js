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
  isMcqRationaleCandidateRejectV23b2bEnabled,
  isMcqRationaleReplacementV23b2b2Enabled,
} = require("../config/mcqRationaleBackfillFlags");
const {
  CandidateServiceError,
  resolveImageContext,
  buildSourceSnapshot,
  toCandidateDto,
  findRejectedCandidateForLineage,
  findExactMcqPart,
  isCompositeQuestion,
} = require("./examQuestionRationaleCandidateService");
const {
  findRejectedAttemptOneForLineage,
  findAttemptTwoForGenerationGroup,
  buildGenerationGroupKey,
} = require("./examQuestionRationaleCandidateLineageService");

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
 * Bounded lineage history for the current fingerprint/group only (max 2).
 * Privacy: no rejectedBy, rejectionNote, lease, idempotency, generatedBy, sourceSnapshot.
 */
function toCandidateHistoryItem(doc) {
  if (!doc) return null;
  const rejectionReasonCode =
    typeof doc.rejectionReasonCode === "string" && doc.rejectionReasonCode.trim()
      ? String(doc.rejectionReasonCode).trim()
      : undefined;
  return {
    candidateId: String(doc._id),
    status: String(doc.status || ""),
    attemptNumber: Number(doc.attemptNumber) === 2 ? 2 : 1,
    explanation: typeof doc.explanation === "string" ? doc.explanation : "",
    generatedAt: doc.generatedAt ? new Date(doc.generatedAt).toISOString() : null,
    completedAt: doc.completedAt ? new Date(doc.completedAt).toISOString() : null,
    rejectedAt: doc.rejectedAt ? new Date(doc.rejectedAt).toISOString() : null,
    rejectionReasonCode,
    failureCode: typeof doc.failureCode === "string" && doc.failureCode ? String(doc.failureCode) : undefined,
    validationIssueCodes: Array.isArray(doc.validationIssueCodes)
      ? doc.validationIssueCodes.map(String).slice(0, 20)
      : undefined,
  };
}

async function findLineageCandidateHistory({ questionId, partLabel, sourceFingerprint, generationGroupKey }) {
  const rows = await ExamQuestionRationaleCandidate.find({
    questionId,
    partLabel,
    sourceFingerprint,
    generationGroupKey,
    attemptNumber: { $in: [1, 2] },
  })
    .sort({ attemptNumber: 1, generatedAt: 1 })
    .limit(8)
    .lean();

  // Prefer one Attempt 1 (latest rejected/failed/pending if multiple) and one Attempt 2.
  const attempt1 = [...rows].reverse().find((r) => Number(r.attemptNumber) === 1) || null;
  const attempt2 = rows.find((r) => Number(r.attemptNumber) === 2) || null;
  const ordered = [];
  if (attempt1) ordered.push(attempt1);
  if (attempt2) ordered.push(attempt2);
  return ordered.map(toCandidateHistoryItem).filter(Boolean);
}

/**
 * Read-only replacement eligibility for review UI. Never reserves or calls a provider.
 */
async function evaluateReplacementEligibilityForReview({
  questionId,
  partLabel,
  currentSourceFingerprint,
  questionStatus,
  publishedGenerationEnabled,
  classification,
  imageContextRequired,
}) {
  const replacementFeatureEnabled = isMcqRationaleReplacementV23b2b2Enabled();
  const generationFeatureEnabled = isMcqRationaleBackfillV23aEnabled();

  if (!replacementFeatureEnabled) {
    return {
      replacementFeatureEnabled: false,
      canGenerateReplacement: false,
      canGenerateReplacementReason: "REPLACEMENT_FEATURE_DISABLED",
      rejectedAttemptOneId: null,
      generationGroupKey: buildGenerationGroupKey(questionId, partLabel, currentSourceFingerprint),
    };
  }

  const generationGroupKey = buildGenerationGroupKey(questionId, partLabel, currentSourceFingerprint);
  const rejectedDoc = await findRejectedAttemptOneForLineage({
    questionId,
    partLabel,
    sourceFingerprint: currentSourceFingerprint,
  });
  const rejectedAttemptOneId = rejectedDoc ? String(rejectedDoc._id) : null;

  if (!generationFeatureEnabled) {
    return {
      replacementFeatureEnabled: true,
      canGenerateReplacement: false,
      canGenerateReplacementReason: "FEATURE_DISABLED",
      rejectedAttemptOneId,
      generationGroupKey,
    };
  }

  if (questionStatus === "published" && !publishedGenerationEnabled) {
    return {
      replacementFeatureEnabled: true,
      canGenerateReplacement: false,
      canGenerateReplacementReason: "PUBLISHED_NOT_ENABLED",
      rejectedAttemptOneId,
      generationGroupKey,
    };
  }
  if (questionStatus !== "draft" && questionStatus !== "published") {
    return {
      replacementFeatureEnabled: true,
      canGenerateReplacement: false,
      canGenerateReplacementReason: "NOT_ELIGIBLE",
      rejectedAttemptOneId,
      generationGroupKey,
    };
  }

  if (classification.structureReason) {
    return {
      replacementFeatureEnabled: true,
      canGenerateReplacement: false,
      canGenerateReplacementReason: "PART_MALFORMED",
      rejectedAttemptOneId,
      generationGroupKey,
    };
  }

  if (imageContextRequired) {
    return {
      replacementFeatureEnabled: true,
      canGenerateReplacement: false,
      canGenerateReplacementReason: "IMAGE_CONTEXT_REQUIRED",
      rejectedAttemptOneId,
      generationGroupKey,
    };
  }

  if (!rejectedDoc) {
    // Rejected Attempt 1 on a prior fingerprint for this part → source changed (no stale action id).
    const priorRejected = await ExamQuestionRationaleCandidate.findOne({
      questionId,
      partLabel,
      status: "rejected",
      active: false,
      attemptNumber: 1,
    })
      .select({ _id: 1, sourceFingerprint: 1 })
      .lean();
    const priorFp = String(priorRejected?.sourceFingerprint || "")
      .trim()
      .toLowerCase();
    const authFp = String(currentSourceFingerprint || "")
      .trim()
      .toLowerCase();
    if (priorRejected && priorFp && priorFp !== authFp) {
      return {
        replacementFeatureEnabled: true,
        canGenerateReplacement: false,
        canGenerateReplacementReason: "SOURCE_CHANGED",
        rejectedAttemptOneId: null,
        generationGroupKey,
      };
    }
    return {
      replacementFeatureEnabled: true,
      canGenerateReplacement: false,
      canGenerateReplacementReason: "NO_REJECTED_ATTEMPT_ONE",
      rejectedAttemptOneId: null,
      generationGroupKey,
    };
  }

  if (String(rejectedDoc.status) !== "rejected") {
    return {
      replacementFeatureEnabled: true,
      canGenerateReplacement: false,
      canGenerateReplacementReason: "CANDIDATE_NOT_REJECTED",
      rejectedAttemptOneId,
      generationGroupKey,
    };
  }
  if (rejectedDoc.active === true) {
    return {
      replacementFeatureEnabled: true,
      canGenerateReplacement: false,
      canGenerateReplacementReason: "CANDIDATE_STILL_ACTIVE",
      rejectedAttemptOneId,
      generationGroupKey,
    };
  }
  if (Number(rejectedDoc.attemptNumber) !== 1) {
    return {
      replacementFeatureEnabled: true,
      canGenerateReplacement: false,
      canGenerateReplacementReason: "ATTEMPT_1_REQUIRED",
      rejectedAttemptOneId,
      generationGroupKey,
    };
  }

  const rejectedFp = String(rejectedDoc.sourceFingerprint || "")
    .trim()
    .toLowerCase();
  const authFp = String(currentSourceFingerprint || "")
    .trim()
    .toLowerCase();
  if (!rejectedFp || rejectedFp !== authFp) {
    return {
      replacementFeatureEnabled: true,
      canGenerateReplacement: false,
      canGenerateReplacementReason: "SOURCE_CHANGED",
      rejectedAttemptOneId: null,
      generationGroupKey,
    };
  }

  if (String(rejectedDoc.generationGroupKey || "") !== generationGroupKey) {
    return {
      replacementFeatureEnabled: true,
      canGenerateReplacement: false,
      canGenerateReplacementReason: "SOURCE_CHANGED",
      rejectedAttemptOneId: null,
      generationGroupKey,
    };
  }

  const attemptTwo = await findAttemptTwoForGenerationGroup(generationGroupKey);
  if (attemptTwo) {
    return {
      replacementFeatureEnabled: true,
      canGenerateReplacement: false,
      canGenerateReplacementReason:
        String(attemptTwo.status) === "failed" ? "ATTEMPT_LIMIT_REACHED" : "ATTEMPT_2_ALREADY_EXISTS",
      rejectedAttemptOneId,
      generationGroupKey,
    };
  }

  const blocking = await findActiveBlockingCandidate(questionId, partLabel);
  if (blocking) {
    return {
      replacementFeatureEnabled: true,
      canGenerateReplacement: false,
      canGenerateReplacementReason: "ACTIVE_CANDIDATE_EXISTS",
      rejectedAttemptOneId,
      generationGroupKey,
    };
  }

  // Replacement regenerates for the same source lineage; structural validity already checked.
  // Do not require potentiallyEligibleForBackfill (fingerprint change blocks substantive edits).
  return {
    replacementFeatureEnabled: true,
    canGenerateReplacement: true,
    canGenerateReplacementReason: null,
    rejectedAttemptOneId,
    generationGroupKey,
  };
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
  const rejectionFeatureEnabled = isMcqRationaleCandidateRejectV23b2bEnabled();

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
      // Shared rejected-lineage detector (independent of active). Blocks until B2b2.
      const rejectedLineage = await findRejectedCandidateForLineage({
        questionId: req.questionId,
        partLabel: req.partLabel,
        sourceFingerprint: currentSourceFingerprint,
      });
      if (rejectedLineage) {
        canGenerate = false;
        canGenerateReason = "REPLACEMENT_GENERATION_NOT_ENABLED";
      } else {
        canGenerate = true;
        canGenerateReason = "";
      }
    }
  }

  let canReject = false;
  let rejectDisabledReason = null;
  if (!rejectionFeatureEnabled) {
    rejectDisabledReason = "FEATURE_DISABLED";
  } else if (!latestDoc) {
    rejectDisabledReason = "NO_CANDIDATE";
  } else if (String(latestDoc.questionId) !== req.questionId || latestDoc.partLabel !== req.partLabel) {
    rejectDisabledReason = "ASSOCIATION_MISMATCH";
  } else if (candidateIsStale) {
    rejectDisabledReason = "STALE_SOURCE";
  } else if (String(latestDoc.status) === "rejected") {
    rejectDisabledReason = "ALREADY_REJECTED";
  } else if (String(latestDoc.status) !== "pending") {
    rejectDisabledReason = "NOT_PENDING";
  } else if (latestDoc.active !== true) {
    rejectDisabledReason = "NOT_ACTIVE";
  } else {
    canReject = true;
    rejectDisabledReason = null;
  }

  const replacementEval = await evaluateReplacementEligibilityForReview({
    questionId: req.questionId,
    partLabel: req.partLabel,
    currentSourceFingerprint,
    questionStatus,
    publishedGenerationEnabled,
    classification,
    imageContextRequired,
  });

  const candidateHistory = await findLineageCandidateHistory({
    questionId: req.questionId,
    partLabel: req.partLabel,
    sourceFingerprint: currentSourceFingerprint,
    generationGroupKey: replacementEval.generationGroupKey,
  });

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
    rejectionFeatureEnabled,
    canReject,
    rejectDisabledReason,
    replacementFeatureEnabled: Boolean(replacementEval.replacementFeatureEnabled),
    canGenerateReplacement: Boolean(replacementEval.canGenerateReplacement),
    canGenerateReplacementReason: replacementEval.canGenerateReplacementReason,
    rejectedAttemptOneId: replacementEval.rejectedAttemptOneId,
    candidateHistory,
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
  evaluateReplacementEligibilityForReview,
  toCandidateHistoryItem,
  findLineageCandidateHistory,
};
