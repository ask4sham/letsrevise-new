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

module.exports = async function auth(req, res, next) {
  try {
    // ✅ Accept BOTH:
    // - Authorization: Bearer <token>
    // - x-auth-token: <token> (legacy/fallback)
    const authHeader =
      req.header("Authorization") ||
      req.header("authorization") ||
      req.headers.authorization ||
      "";

    const tokenFromBearer =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
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

    // Verify token
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });

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

    return next();
  } catch (err) {
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

    return res.status(401).json({ msg });
  }
};
