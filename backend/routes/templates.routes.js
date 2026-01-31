const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Template = require("../models/Template");

/**
 * GET /api/templates
 * Admin-only: list all lesson templates
 */
router.get("/", auth, async (req, res) => {
  try {
    if (req.user?.userType !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    const templates = await Template.find().sort({ createdAt: -1 }).lean();

    return res.json(templates);
  } catch (error) {
    console.error("GET /api/templates ERROR", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
