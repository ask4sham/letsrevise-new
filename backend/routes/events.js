const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Event = require("../models/Event");
const User = require("../models/User");
const { getJwtSecret } = require("../utils/jwtSecret");

const router = express.Router();

/**
 * Optionally attach req.user from JWT (no 401). Used so we can record userId when present.
 */
async function attachUserIfToken(req) {
  const authHeader =
    req.get("Authorization") || req.get("authorization") || "";
  const token =
    typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : req.get("x-auth-token") || req.get("X-Auth-Token") || null;
  if (!token) return;
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    const userId =
      decoded.userId || decoded.id || decoded.user?.id || decoded.user?._id || decoded._id;
    if (!userId) return;
    const user = await User.findById(userId).select("_id").lean();
    if (user) req.user = { _id: user._id };
  } catch {
    // ignore invalid/expired token; event will be anonymous
  }
}

/**
 * Minimal event collector.
 * POST /api/events — body: { type, lessonId?, meta? }.
 * Accepts anonymous events; attaches userId when auth header is valid.
 */
router.post("/", async (req, res) => {
  try {
    await attachUserIfToken(req);

    const { type, lessonId, meta } = req.body || {};

    if (!type || typeof type !== "string") {
      return res.status(400).json({ error: "Missing event type" });
    }

    const doc = {
      type,
      meta: meta && typeof meta === "object" ? meta : {},
      userAgent: req.get("user-agent") || "",
      ip: (req.headers["x-forwarded-for"] && String(req.headers["x-forwarded-for"]).split(",")[0]?.trim()) || req.ip || "",
    };

    if (req.user?._id && mongoose.Types.ObjectId.isValid(String(req.user._id))) {
      doc.userId = req.user._id;
    }

    if (lessonId && mongoose.Types.ObjectId.isValid(String(lessonId))) {
      doc.lessonId = lessonId;
    }

    await Event.create(doc);
    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/events error:", err);
    return res.status(500).json({ error: "Failed to record event" });
  }
});

module.exports = router;
