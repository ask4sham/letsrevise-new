// /backend/middleware/auth.js
console.log("🔐 Auth middleware (JWT)");

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

// ✅ SINGLE SOURCE OF TRUTH (same as signing)
const { getJwtSecret } = require("../utils/jwtSecret");

function secretFingerprint(secret) {
  // Non-sensitive fingerprint to compare deployments/configs safely
  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  return `len=${secret.length}, sha256=${hash.slice(0, 12)}…`;
}

function shouldDebugJwt() {
  return process.env.DEBUG_JWT === "1" || process.env.DEBUG_JWT === "true";
}

/**
 * ✅ Auth middleware
 * - Guards `next` so we never throw "next is not a function"
 * - Keeps existing behaviour for Express routes
 */
module.exports = function auth(req, res, next) {
  const nextFn =
    typeof next === "function"
      ? next
      : (err) => {
          // If someone accidentally called auth(req,res) without next:
          if (err) console.error("Auth middleware error (no next provided):", err);
          // Do nothing. (We will always respond via res in this middleware anyway.)
        };

  (async () => {
    // ✅ Accept BOTH:
    // - Authorization: Bearer <token>
    // - x-auth-token: <token> (legacy/fallback)
    const authHeader =
      req.header("Authorization") ||
      req.header("authorization") ||
      req.headers.authorization ||
      "";

    const tokenFromBearer =
      typeof authHeader === "string" &&
      authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : null;

    const tokenFromXAuth =
      req.header("x-auth-token") || req.header("X-Auth-Token") || null;

    const token = tokenFromBearer || tokenFromXAuth;

    if (!token) {
      return res.status(401).json({ msg: "No token, authorization denied" });
    }

    // ✅ same selection/trim rule used everywhere (SIGN + VERIFY)
    const secret = getJwtSecret();

    if (shouldDebugJwt()) {
      const decodedHeader = jwt.decode(token, { complete: true })?.header;
      console.log(
        `🧾 JWT header: alg=${decodedHeader?.alg || "?"}, kid=${decodedHeader?.kid || "-"}`
      );
      console.log(`🔑 JWT_SECRET fingerprint (VERIFY): ${secretFingerprint(secret)}`);
      console.log(`🌐 VERIFY host=${req.get("host")} path=${req.originalUrl}`);
    }

    // ✅ CHANGED: Using JWT_SECRET_KEY directly from environment
    const jwtSecretKey = process.env.JWT_SECRET_KEY;
    if (!jwtSecretKey) {
      console.error("❌ JWT_SECRET_KEY environment variable is not set");
      return res.status(500).json({ msg: "Server configuration error" });
    }

    // ✅ CHANGED: Verify token with JWT_SECRET_KEY
    const decoded = jwt.verify(token, jwtSecretKey, { algorithms: ["HS256"] });

    // Support common payload shapes
    const userId =
      decoded.userId ||
      decoded.id ||
      decoded.user?.id ||
      decoded.user?._id ||
      decoded._id;

    if (!userId) {
      return res
        .status(401)
        .json({ msg: "Token valid but user id missing in payload" });
    }

    // Get user from database to get userType and ensure user still exists
    const user = await User.findById(userId).select(
      "userType firstName lastName email"
    );

    if (!user) {
      return res.status(401).json({ msg: "User not found in database" });
    }

    // Keep req.user predictable
    req.user = {
      userId: String(userId),
      _id: String(userId),
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      tokenPayload: decoded,
    };

    if (shouldDebugJwt()) {
      console.log(`✅ Auth OK: ${user.userType} ${user.email}`);
    }

    return nextFn();
  })().catch((err) => {
    console.error(
      "❌ JWT VERIFY FAILED:",
      JSON.stringify({ name: err?.name, message: err?.message }, null, 2)
    );

    const isProd = process.env.NODE_ENV === "production";

    const msg =
      err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError"
        ? isProd
          ? "Token is not valid"
          : `Token invalid: ${err.message}`
        : "Token is not valid";

    // Always respond (do not rely on next existing)
    try {
      return res.status(401).json({ msg });
    } catch (e) {
      // In case headers already sent
      return nextFn(err);
    }
  });
};