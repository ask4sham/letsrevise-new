// backend/utils/recordLoginSuccess.js
// Fail-open login activity writes — must never block or reject valid login.
const User = require("../models/User");
const LoginEvent = require("../models/LoginEvent");

/**
 * Perform lastLoginAt update and LoginEvent insert independently.
 * @param {import("mongoose").Document} userDoc
 * @param {Date} loggedInAt
 */
async function performLoginSuccessWrites(userDoc, loggedInAt) {
  const userId = userDoc._id;
  const eventPayload = {
    userId,
    loggedInAt,
    emailSnapshot: userDoc.email,
    firstNameSnapshot: userDoc.firstName,
    lastNameSnapshot: userDoc.lastName || "",
    userTypeSnapshot: userDoc.userType,
  };

  const results = await Promise.allSettled([
    User.updateOne({ _id: userId }, { $set: { lastLoginAt: loggedInAt } }),
    LoginEvent.create(eventPayload),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      const reason = result.reason;
      console.error(
        "[LoginActivity] Failed to record:",
        reason?.message || reason
      );
    }
  }
}

/**
 * Schedule login activity writes without blocking the caller.
 * Returns immediately; never throws.
 * @param {{ user: import("mongoose").Document, loggedInAt: Date }} opts
 */
function recordLoginSuccess({ user: userDoc, loggedInAt }) {
  void performLoginSuccessWrites(userDoc, loggedInAt).catch((err) => {
    console.error("[LoginActivity] Unexpected failure:", err?.message || err);
  });
}

module.exports = { recordLoginSuccess, performLoginSuccessWrites };
