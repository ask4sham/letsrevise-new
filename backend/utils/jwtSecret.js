// /backend/utils/jwtSecret.js

/**
 * Single source of truth for JWT secret selection.
 * IMPORTANT:
 * - Must be identical for SIGN + VERIFY.
 * - Trims whitespace/newlines to prevent "invalid signature" on Render/etc.
 */
function getJwtSecret() {
  const candidates = [
    process.env.JWT_SECRET,
    process.env.JWT_SECRET_KEY,
    process.env.JWT_KEY,
    process.env.SECRET,
  ];

  for (const raw of candidates) {
    const secret = typeof raw === "string" ? raw.trim() : "";
    if (secret) return secret;
  }

  throw new Error(
    "JWT secret is not set. Expected one of: JWT_SECRET, JWT_SECRET_KEY, JWT_KEY, SECRET."
  );
}

module.exports = { getJwtSecret };
