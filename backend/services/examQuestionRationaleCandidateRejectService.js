/**
 * V2.3B2b1 — reject a pending rationale Candidate.
 * Candidate-only mutation. No LLM. No ExamQuestion / Lesson writes.
 */
const mongoose = require("mongoose");
const ExamQuestionRationaleCandidate = require("../models/ExamQuestionRationaleCandidate");
const { isMcqRationaleCandidateRejectV23b2bEnabled } = require("../config/mcqRationaleBackfillFlags");
const {
  REJECTION_REASON_CODES,
  MAX_REJECTION_NOTE_LENGTH,
  isValidRejectionReasonCode,
} = require("../utils/mcqRationaleRejectionReasons");
const { normalizeText } = require("../utils/mcqRationaleSourceFingerprint");
const {
  CandidateServiceError,
  toCandidateDto,
} = require("./examQuestionRationaleCandidateService");

const FINGERPRINT_RE = /^[a-f0-9]{64}$/i;
const ALLOWED_REJECT_BODY_KEYS = new Set([
  "questionId",
  "partLabel",
  "expectedSourceFingerprint",
  "reasonCode",
  "note",
]);

function actorObjectId(actorId) {
  return new mongoose.Types.ObjectId(String(actorId));
}

function normalizeNote(note) {
  if (note == null || note === "") return "";
  if (typeof note !== "string") {
    throw new CandidateServiceError(400, "INVALID_REJECTION_NOTE", "note must be a string when provided");
  }
  const trimmed = note.trim();
  if (trimmed.length > MAX_REJECTION_NOTE_LENGTH) {
    throw new CandidateServiceError(
      400,
      "REJECTION_NOTE_TOO_LONG",
      `note must be at most ${MAX_REJECTION_NOTE_LENGTH} characters`
    );
  }
  return trimmed;
}

function parseRejectBody(body) {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    throw new CandidateServiceError(400, "INVALID_BODY", "Request body must be a JSON object");
  }
  for (const k of Object.keys(body)) {
    if (!ALLOWED_REJECT_BODY_KEYS.has(k)) {
      throw new CandidateServiceError(400, "UNEXPECTED_FIELD", `Unexpected field: ${k}`);
    }
  }

  const questionId = body.questionId;
  const partLabel = body.partLabel;
  const expectedSourceFingerprint =
    body.expectedSourceFingerprint == null ? "" : String(body.expectedSourceFingerprint).trim().toLowerCase();
  const reasonCode = body.reasonCode == null ? "" : String(body.reasonCode).trim();
  const note = normalizeNote(body.note);

  if (typeof questionId !== "string" || !mongoose.Types.ObjectId.isValid(questionId)) {
    throw new CandidateServiceError(400, "INVALID_QUESTION_ID", "Valid questionId required");
  }
  if (typeof partLabel !== "string" || !normalizeText(partLabel) || partLabel.length > 32) {
    throw new CandidateServiceError(400, "INVALID_PART_LABEL", "partLabel must be a short string");
  }
  if (!expectedSourceFingerprint || !FINGERPRINT_RE.test(expectedSourceFingerprint)) {
    throw new CandidateServiceError(
      400,
      "INVALID_SOURCE_FINGERPRINT",
      "expectedSourceFingerprint must be SHA-256 hex"
    );
  }
  if (!isValidRejectionReasonCode(reasonCode)) {
    throw new CandidateServiceError(
      400,
      "INVALID_REJECTION_REASON",
      `reasonCode must be one of: ${REJECTION_REASON_CODES.join(", ")}`
    );
  }

  return {
    questionId: String(questionId),
    partLabel: normalizeText(partLabel),
    expectedSourceFingerprint,
    reasonCode,
    note,
  };
}

function sameActor(doc, actorId) {
  if (!doc || !doc.rejectedBy) return false;
  return String(doc.rejectedBy) === String(actorId);
}

function notesMatch(stored, requested) {
  return String(stored || "").trim() === String(requested || "").trim();
}

function diagnoseRejectConflict(doc, req, actorId) {
  if (!doc) {
    throw new CandidateServiceError(404, "CANDIDATE_NOT_FOUND", "Rationale candidate not found");
  }
  if (String(doc.questionId) !== req.questionId || doc.partLabel !== req.partLabel) {
    throw new CandidateServiceError(
      409,
      "CANDIDATE_ASSOCIATION_MISMATCH",
      "Candidate does not belong to the requested question part"
    );
  }
  if (String(doc.sourceFingerprint).toLowerCase() !== req.expectedSourceFingerprint) {
    throw new CandidateServiceError(
      409,
      "SOURCE_FINGERPRINT_MISMATCH",
      "Candidate source fingerprint does not match the expected fingerprint"
    );
  }
  if (doc.status === "rejected" && doc.active === false) {
    if (
      sameActor(doc, actorId) &&
      String(doc.rejectionReasonCode || "") === req.reasonCode &&
      notesMatch(doc.rejectionNote, req.note)
    ) {
      return { dto: toCandidateDto(doc), replayed: true };
    }
    throw new CandidateServiceError(
      409,
      "CANDIDATE_ALREADY_REJECTED",
      "Candidate was already rejected with a different rejection request"
    );
  }
  if (doc.status !== "pending") {
    throw new CandidateServiceError(
      409,
      "CANDIDATE_NOT_PENDING",
      "Only pending candidates can be rejected"
    );
  }
  if (doc.active !== true) {
    throw new CandidateServiceError(
      409,
      "CANDIDATE_NOT_ACTIVE",
      "Only active pending candidates can be rejected"
    );
  }
  throw new CandidateServiceError(409, "CANDIDATE_NOT_PENDING", "Candidate could not be rejected");
}

/**
 * @param {{ actorId: string, candidateId: string, body: object, now?: Date }} args
 */
async function rejectRationaleCandidate({ actorId, candidateId, body, now: nowArg }) {
  if (!isMcqRationaleCandidateRejectV23b2bEnabled()) {
    throw new CandidateServiceError(
      404,
      "FEATURE_DISABLED",
      "MCQ rationale candidate rejection is not enabled on this server"
    );
  }

  if (typeof candidateId !== "string" || !mongoose.Types.ObjectId.isValid(candidateId)) {
    throw new CandidateServiceError(400, "INVALID_CANDIDATE_ID", "Valid candidateId required");
  }

  const req = parseRejectBody(body);
  const now = nowArg ? new Date(nowArg) : new Date();
  const actorOid = actorObjectId(actorId);

  const setFields = {
    status: "rejected",
    active: false,
    rejectedBy: actorOid,
    rejectedAt: now,
    rejectionReasonCode: req.reasonCode,
    rejectionNote: req.note,
  };

  const updated = await ExamQuestionRationaleCandidate.findOneAndUpdate(
    {
      _id: candidateId,
      questionId: req.questionId,
      partLabel: req.partLabel,
      sourceFingerprint: req.expectedSourceFingerprint,
      status: "pending",
      active: true,
    },
    { $set: setFields },
    { new: true }
  );

  if (updated) {
    return { dto: toCandidateDto(updated), replayed: false };
  }

  const existing = await ExamQuestionRationaleCandidate.findById(candidateId).lean();
  return diagnoseRejectConflict(existing, req, actorId);
}

module.exports = {
  rejectRationaleCandidate,
  parseRejectBody,
  ALLOWED_REJECT_BODY_KEYS,
  REJECTION_REASON_CODES,
  MAX_REJECTION_NOTE_LENGTH,
};
