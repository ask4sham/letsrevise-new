"use strict";

/**
 * Scoped service-token auth for Lesson Synthesiser draft receiver only.
 * Fail closed. Never log tokens or Authorization headers.
 */

const crypto = require("crypto");

function authError(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    errors: [],
  });
}

function tokensEqual(provided, expected) {
  const a = Buffer.from(String(provided), "utf8");
  const b = Buffer.from(String(expected), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function lessonSynthesiserAuth(req, res, next) {
  const expected = process.env.LETSREVISE_LESSON_SYNTHESISER_TOKEN;
  if (expected == null || !String(expected).trim()) {
    return authError(
      res,
      500,
      "SYNTHESISER_AUTH_CONFIG",
      "Lesson Synthesiser authentication is not configured."
    );
  }

  const header = req.get("authorization") || req.headers.authorization || "";
  const match = /^Bearer\s+(\S+)/i.exec(String(header).trim());
  if (!match) {
    return authError(
      res,
      401,
      "SYNTHESISER_AUTH_REQUIRED",
      "Lesson Synthesiser authentication is required."
    );
  }

  const token = match[1];
  if (!tokensEqual(token, String(expected).trim())) {
    return authError(
      res,
      401,
      "SYNTHESISER_AUTH_INVALID",
      "Lesson Synthesiser authentication failed."
    );
  }

  return next();
}

module.exports = lessonSynthesiserAuth;
