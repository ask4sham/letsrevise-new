/**
 * Class invitation create/list helpers — no User lookups (anti-enumeration).
 */
"use strict";

const StudentClassInvitation = require("../models/StudentClassInvitation");
const { generateOpaquePublicId } = require("../utils/opaquePublicId");
const { parseStudentEmailInput, MAX_UNIQUE_VALID_EMAILS } = require("../utils/studentEmail");

function parseInvitationInput(body) {
  if (!body || typeof body !== "object") {
    return parseStudentEmailInput("");
  }
  if (Array.isArray(body.emails)) {
    return parseStudentEmailInput(body.emails);
  }
  if (typeof body.input === "string") {
    return parseStudentEmailInput(body.input);
  }
  if (typeof body.emails === "string") {
    return parseStudentEmailInput(body.emails);
  }
  return parseStudentEmailInput("");
}

/**
 * Upsert pending invitations for valid emails.
 * - pending: idempotent no-op
 * - accepted/declined/cancelled/expired: leave unchanged (no silent reset)
 * - missing: insert pending
 * Never queries User.
 */
async function processInvitationsForClass({ classDoc, teacherId, validEmails }) {
  if (!validEmails.length) {
    return { inserted: 0, reused: 0 };
  }

  const existing = await StudentClassInvitation.find({
    classId: classDoc._id,
    targetEmail: { $in: validEmails },
  })
    .select("targetEmail status")
    .lean();

  const byEmail = new Map(existing.map((row) => [row.targetEmail, row]));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + StudentClassInvitation.INVITATION_TTL_MS);
  const toInsert = [];

  for (const email of validEmails) {
    const prev = byEmail.get(email);
    if (prev) continue;
    toInsert.push({
      classId: classDoc._id,
      teacherId,
      targetEmail: email,
      status: "pending",
      publicId: generateOpaquePublicId(),
      studentId: null,
      requestedAt: now,
      expiresAt,
    });
  }

  let inserted = 0;
  if (toInsert.length) {
    try {
      const res = await StudentClassInvitation.insertMany(toInsert, { ordered: false });
      inserted = res.length;
    } catch (err) {
      // Duplicate-key race: another concurrent create — treat as success.
      if (err && (err.code === 11000 || err.name === "MongoBulkWriteError")) {
        inserted = (err.result && err.result.nInserted) || 0;
      } else {
        throw err;
      }
    }
  }

  return {
    inserted,
    reused: validEmails.length - toInsert.length,
  };
}

function serializeInvitationForTeacher(doc, now = new Date()) {
  const status = StudentClassInvitation.effectiveStatus(doc, now);
  return {
    publicId: doc.publicId,
    targetEmail: doc.targetEmail,
    status,
    requestedAt: doc.requestedAt,
    expiresAt: doc.expiresAt,
    respondedAt: doc.respondedAt || null,
    cancelledAt: doc.cancelledAt || null,
  };
}

module.exports = {
  MAX_UNIQUE_VALID_EMAILS,
  parseInvitationInput,
  processInvitationsForClass,
  serializeInvitationForTeacher,
};
