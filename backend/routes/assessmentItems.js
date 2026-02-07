const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const AssessmentItem = require("../models/AssessmentItem");
const auth = require("../middleware/auth");

// GET assessment items
router.get("/", auth, async (req, res) => {
  try {
    const {
      subject,
      examBoard,
      level,
      type,
      published,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    if (subject) query.subject = subject;
    if (examBoard) query.examBoard = examBoard;
    if (level) query.level = level;
    if (type) query.type = type;

    if (req.user?.userType === "student") {
      query.isPublished = true;
    } else if (published !== undefined) {
      query.isPublished = published === "true";
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      AssessmentItem.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AssessmentItem.countDocuments(query)
    ]);

    res.json({
      success: true,
      items,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    console.error("AssessmentItems GET error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

// GET single assessment item by ID
router.get("/:id", async (req, res) => {
  console.log("✅ HIT: GET /api/assessment-items/:id", req.params.id);
  
  try {
    // Try to find the item directly, let MongoDB handle the ID validation
    const item = await AssessmentItem.findById(req.params.id);

    if (!item) {
      console.log("❌ Assessment item not found:", req.params.id);
      return res.status(404).json({ 
        success: false, 
        msg: "Assessment item not found" 
      });
    }

    console.log("✅ Found item:", item._id, item.title);
    res.json({ success: true, item });
  } catch (err) {
    console.error("❌ Error fetching assessment item:", err);
    console.error("❌ Error details:", err.message);
    
    // Check if it's an invalid ID error
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      return res.status(400).json({ 
        success: false, 
        msg: "Invalid assessment item ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      msg: "Server error"
    });
  }
});

// POST create assessment item (teacher/admin)
router.post("/", auth, async (req, res) => {
  if (!["teacher", "admin"].includes(req.user.userType)) {
    return res.status(403).json({ success: false, msg: "Forbidden" });
  }

  try {
    const item = await AssessmentItem.create({
      ...req.body,
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, item });
  } catch (err) {
    console.error("AssessmentItems POST error:", err);
    res.status(400).json({ success: false, msg: err.message });
  }
});

module.exports = router;