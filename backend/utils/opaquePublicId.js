/**
 * Opaque public identifiers for teacher/student-facing APIs (not Mongo ObjectIds).
 * Matches WorksheetAssignment.shareId style: crypto.randomBytes(12).base64url
 */
"use strict";

const crypto = require("crypto");

function generateOpaquePublicId() {
  return crypto.randomBytes(12).toString("base64url");
}

module.exports = {
  generateOpaquePublicId,
};
