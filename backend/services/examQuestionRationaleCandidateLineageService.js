/**
 * V2.3B2b2a — shared Candidate lineage helpers for rejected Attempt 1 / Attempt 2.
 * Does not call providers. Does not write ExamQuestion / Lesson.
 */
const mongoose = require("mongoose");
const ExamQuestionRationaleCandidate = require("../models/ExamQuestionRationaleCandidate");
const { buildGenerationGroupKey, normalizeText } = require("../utils/mcqRationaleSourceFingerprint");
const { CandidateServiceError } = require("./examQuestionRationaleCandidateService");

async function findRejectedAttemptOneForLineage({ questionId, partLabel, sourceFingerprint }) {
  return ExamQuestionRationaleCandidate.findOne({
    questionId,
    partLabel,
    sourceFingerprint,
    status: "rejected",
    active: false,
    attemptNumber: 1,
  }).lean();
}

async function findAttemptTwoForGenerationGroup(generationGroupKey) {
  if (!generationGroupKey) return null;
  return ExamQuestionRationaleCandidate.findOne({
    generationGroupKey: String(generationGroupKey),
    attemptNumber: 2,
  }).lean();
}

/**
 * Assert rejected Attempt 1 is eligible for replacement against authoritative lineage values.
 * @returns {{ rejected: object, generationGroupKey: string }}
 */
function assertReplacementEligibility({
  rejectedCandidateId,
  rejectedDoc,
  questionId,
  partLabel,
  authoritativeSourceFingerprint,
  expectedSourceFingerprint,
}) {
  if (!rejectedDoc) {
    throw new CandidateServiceError(404, "CANDIDATE_NOT_FOUND", "Rationale candidate not found");
  }

  if (String(rejectedDoc._id) !== String(rejectedCandidateId)) {
    throw new CandidateServiceError(404, "CANDIDATE_NOT_FOUND", "Rationale candidate not found");
  }

  if (String(rejectedDoc.questionId) !== String(questionId) || rejectedDoc.partLabel !== partLabel) {
    throw new CandidateServiceError(
      409,
      "CANDIDATE_ASSOCIATION_MISMATCH",
      "Candidate does not belong to the requested question part"
    );
  }

  const rejectedFp = String(rejectedDoc.sourceFingerprint || "")
    .trim()
    .toLowerCase();
  const expectedFp = String(expectedSourceFingerprint || "")
    .trim()
    .toLowerCase();
  const authFp = String(authoritativeSourceFingerprint || "")
    .trim()
    .toLowerCase();

  if (!expectedFp || rejectedFp !== expectedFp) {
    throw new CandidateServiceError(
      409,
      "SOURCE_FINGERPRINT_MISMATCH",
      "Candidate source fingerprint does not match the expected fingerprint"
    );
  }

  if (rejectedFp !== authFp || expectedFp !== authFp) {
    throw new CandidateServiceError(
      409,
      "SOURCE_CHANGED",
      "The question source has changed since this candidate was generated"
    );
  }

  if (String(rejectedDoc.status) !== "rejected") {
    throw new CandidateServiceError(409, "CANDIDATE_NOT_REJECTED", "Only rejected Attempt 1 candidates can be replaced");
  }

  if (rejectedDoc.active === true) {
    throw new CandidateServiceError(409, "CANDIDATE_STILL_ACTIVE", "Rejected candidate must be inactive before replacement");
  }

  if (Number(rejectedDoc.attemptNumber) !== 1) {
    throw new CandidateServiceError(409, "ATTEMPT_1_REQUIRED", "Replacement requires rejected Attempt 1");
  }

  const generationGroupKey = buildGenerationGroupKey(questionId, partLabel, authFp);
  if (String(rejectedDoc.generationGroupKey || "") !== generationGroupKey) {
    throw new CandidateServiceError(
      409,
      "CANDIDATE_ASSOCIATION_MISMATCH",
      "Candidate generation group does not match the current source lineage"
    );
  }

  return { rejected: rejectedDoc, generationGroupKey };
}

function isValidObjectId(id) {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

function normalizePartLabel(partLabel) {
  if (typeof partLabel !== "string" || !normalizeText(partLabel) || partLabel.length > 32) {
    throw new CandidateServiceError(400, "INVALID_PART_LABEL", "partLabel must be a short string");
  }
  return normalizeText(partLabel);
}

module.exports = {
  findRejectedAttemptOneForLineage,
  findAttemptTwoForGenerationGroup,
  assertReplacementEligibility,
  isValidObjectId,
  normalizePartLabel,
  buildGenerationGroupKey,
};
