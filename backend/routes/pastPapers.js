/**
 * PR-PAST-PAPERS-API-1: GET /api/past-papers/mine — teacher-owned PastPaper records + filtering.
 */
const express = require("express");
const router = express.Router();
const PastPaper = require("../models/PastPaper");
const auth = require("../middleware/auth");

function clampInt(v, { min, max, fallback }) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

router.get("/mine", auth, async (req, res) => {
  try {
    const actorId = req.user?._id || req.user?.id;
    if (!actorId) return res.status(401).json({ error: "Unauthorized" });

    const {
      specKey,
      examBoard,
      level,
      year,
      series,
      tier,
      paperCode,
      q,
      cursor,
    } = req.query || {};

    const limit = clampInt(req.query?.limit, { min: 1, max: 200, fallback: 50 });

    const query = { ownerId: actorId };

    if (specKey) query.specKey = String(specKey).trim();
    if (examBoard) query.examBoard = String(examBoard).trim();
    if (level) query.level = String(level).trim();
    if (year) query.year = String(year).trim();
    if (series) query.series = String(series).trim();
    if (tier) query.tier = String(tier).trim();
    if (paperCode) query.paperCode = String(paperCode).trim();

    if (q) {
      const pattern = String(q).trim();
      if (pattern) {
        query.$or = [
          { title: { $regex: pattern, $options: "i" } },
          { paperCode: { $regex: pattern, $options: "i" } },
          { series: { $regex: pattern, $options: "i" } },
        ];
      }
    }

    if (cursor) {
      const dt = new Date(String(cursor));
      if (!Number.isNaN(dt.getTime())) {
        query.createdAt = { $lt: dt };
      }
    }

    const items = await PastPaper.find(query)
      .sort({ createdAt: -1, year: -1 })
      .limit(limit)
      .lean();

    const nextCursor = items.length ? items[items.length - 1].createdAt : null;

    return res.status(200).json({
      items,
      nextCursor: nextCursor != null ? nextCursor.toISOString ? nextCursor.toISOString() : String(nextCursor) : null,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message || "Failed to load past papers" });
  }
});

module.exports = router;
