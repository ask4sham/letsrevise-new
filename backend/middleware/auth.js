// /backend/middleware/auth.js
if (process.env.NODE_ENV !== "production") {
  console.log("🔐 Auth middleware (JWT)");
}

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { isActiveUserDoc } = require("../utils/activeUser");
const { normalizeSubscriptionV2 } = require("../contracts/subscriptionV2");

const { getJwtSecret } = require("../utils/jwtSecret");
const { IS_PRODUCTION } = require("../utils/safeErrorResponse");

function secretFingerprint(secret) {
  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  return `len=${secret.length}, sha256=${hash.slice(0, 12)}…`;
}

function shouldDebugJwt() {
  return process.env.DEBUG_JWT === "1" || process.env.DEBUG_JWT === "true";
}

/**
 * Auth middleware: verify JWT, attach req.user. 401 on missing/invalid token.
 */
module.exports = function auth(req, res, next) {
  const nextFn = typeof next === "function" ? next : () => {};

  (async () => {
    const authHeader =
      req.header("Authorization") ||
      req.header("authorization") ||
      req.headers.authorization ||
      "";
    const tokenFromBearer =
      typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : "";
    const token = tokenFromBearer || req.header("x-auth-token") || req.header("X-Auth-Token") || "";

    if (!token || token.length < 10) {
      return res.status(401).json({ msg: "No token or token too short" });
    }

    try {
      let secret;
      try {
        secret = getJwtSecret();
      } catch (configErr) {
        console.error("[auth] JWT secret not configured");
        return res.status(500).json({ msg: "Server configuration error", code: "AUTH_CONFIG" });
      }
      const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
      const userId = decoded.userId || decoded.user?.id || decoded.user?._id || decoded.id || decoded._id;
      if (!userId) {
        return res.status(401).json({ msg: "Token valid but user id missing" });
      }
      const user = await User.findById(userId).select("-password").lean();
      if (!user) {
        return res.status(401).json({ msg: "User not found" });
      }
      if (!isActiveUserDoc(user)) {
        return res.status(401).json({
          msg: "This account has been closed. Contact support if you need access.",
          code: "ACCOUNT_DELETED",
        });
      }
      req.user = {
        _id: user._id,
        id: user._id,
        userId: user._id,
        userType: user.userType || user.type,
        type: user.userType || user.type,
        isAdmin: (user.userType || user.type || "").toString().toLowerCase() === "admin",
        ...user,
      };
      if (shouldDebugJwt()) {
        console.log("[auth] user attached:", req.user._id, req.user.userType);
      }
      return nextFn();
    } catch (err) {
      if (shouldDebugJwt()) {
        console.log("[auth] verify failed:", err.message);
      } else if (IS_PRODUCTION) {
        console.log("[auth] token rejected");
      }
      return res.status(401).json({ msg: "Token is not valid", code: "INVALID_TOKEN" });
    }
  })();
};
