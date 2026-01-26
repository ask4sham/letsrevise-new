// backend/routes/assessmentItems.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const AssessmentItem = require("../models/AssessmentItem");
const auth = require("../middleware/auth");

/* =========================================
   ROLE ENFORCEMENT HELPERS
   ========================================= */

function isAdmin(user) {
  return user?.userType === "admin" || user?.role === "admin" || user?.isAdmin === true;
}

function isTeacher(user) {
  return user?.userType === "teacher";
}

function isTeacherOrAdmin(user) {
  return isTeacher(user) || isAdmin(user);
}

function isStudent(user) {
  return user?.userType === "student";
}

/* =========================================
   GET /api/assessment-items
   - Students: only published items
   - Teachers/Admins: can see all (published + drafts)
   - Supports filters: subject, topic, type, published, q (search in prompt), page, limit
   ========================================= */

router.get("/", auth, async (req, res) => {
  try {
    const {
      subject,
      topic,
      type,
      published,
      q,
      page = 1,
      limit = 20,
    } = req.query;

    const requesterType = req.user?.userType;

    // Build query based on user role
    const query = {};

    // Students can only see published items
    if (isStudent(req.user)) {
      query.isPublished = true;
    } else if (isTeacherOrAdmin(req.user)) {
      // Teachers/Admins can filter by published status if provided
      if (published !== undefined) {
        query.isPublished = published === "true" || published === true;
      }
      // If not specified, they see all (published + drafts)
    } else {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    // Apply filters
    if (subject) {
      query.subject = subject;
    }
    if (topic) {
      query.topic = topic;
    }
    if (type && ["short", "mcq"].includes(type)) {
      query.type = type;
    }

    // Search in prompt
    if (q) {
      query.prompt = { $regex: q, $options: "i" };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { createdAt: -1 };

    const items = await AssessmentItem.find(query)
      .populate("createdBy", "firstName lastName email")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalItems = await AssessmentItem.countDocuments(query);

    return res.json({
      success: true,
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalItems,
        pages: Math.ceil(totalItems / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Get assessment items error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/assessment-items/:id
   - Same visibility rules as list endpoint
   ========================================= */

router.get("/:id", auth, async (req, res) => {
  try {
    const itemId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ msg: "Invalid assessment item id" });
    }

    const item = await AssessmentItem.findById(itemId)
      .populate("createdBy", "firstName lastName email")
      .lean();

    if (!item) {
      return res.status(404).json({ msg: "Assessment item not found" });
    }

    // Check visibility: students can only see published items
    if (isStudent(req.user) && !item.isPublished) {
      return res.status(403).json({ msg: "Assessment item not published" });
    }

    // Teachers/Admins can see all items
    if (!isTeacherOrAdmin(req.user) && !isStudent(req.user)) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    return res.json({
      success: true,
      item,
    });
  } catch (err) {
    console.error("Get assessment item error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   POST /api/assessment-items
   - Teacher/Admin only
   ========================================= */

router.post("/", auth, async (req, res) => {
  try {
    // Check authorization
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ msg: "Only teachers and admins can create assessment items" });
    }

    const {
      subject,
      topic,
      subtopic,
      level,
      examBoard,
      type,
      prompt,
      marks,
      correctAnswer,
      markSchemeText,
      options,
      correctIndex,
      difficulty,
      tags,
      isPublished,
    } = req.body;

    // Validate required fields
    if (!subject || !topic || !type || !prompt || !marks) {
      return res.status(400).json({
        msg: "Missing required fields: subject, topic, type, prompt, marks",
      });
    }

    // Validate type-specific fields
    if (type === "short" && !correctAnswer) {
      return res.status(400).json({
        msg: "correctAnswer is required for short answer questions",
      });
    }

    if (type === "mcq") {
      if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
        return res.status(400).json({
          msg: "MCQ questions must have 2-6 options",
        });
      }
      if (
        !Number.isInteger(correctIndex) ||
        correctIndex < 0 ||
        correctIndex >= options.length
      ) {
        return res.status(400).json({
          msg: "correctIndex must be a valid index for the options array",
        });
      }
    }

    // Determine createdByRole
    const createdByRole = isAdmin(req.user) ? "admin" : "teacher";

    // Create assessment item
    const assessmentItem = new AssessmentItem({
      createdBy: req.user._id,
      createdByRole,
      examBoard: examBoard || "AQA",
      subject,
      topic,
      subtopic: subtopic || "",
      level: level || "GCSE",
      type,
      prompt,
      marks: parseInt(marks),
      correctAnswer: type === "short" ? correctAnswer : undefined,
      markSchemeText: markSchemeText || "",
      options: type === "mcq" ? options : [],
      correctIndex: type === "mcq" ? correctIndex : null,
      difficulty: difficulty || "medium",
      tags: Array.isArray(tags) ? tags : [],
      isPublished: isPublished === true || isPublished === "true",
    });

    await assessmentItem.save();

    return res.status(201).json({
      success: true,
      item: assessmentItem,
    });
  } catch (err) {
    console.error("Create assessment item error:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ msg: "Validation error", error: err.message });
    }
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   PUT /api/assessment-items/:id
   - Teacher can edit own items
   - Admin can edit any item
   ========================================= */

router.put("/:id", auth, async (req, res) => {
  try {
    const itemId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ msg: "Invalid assessment item id" });
    }

    // Check authorization
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ msg: "Only teachers and admins can edit assessment items" });
    }

    const item = await AssessmentItem.findById(itemId);

    if (!item) {
      return res.status(404).json({ msg: "Assessment item not found" });
    }

    // Teachers can only edit their own items; admins can edit any
    const isOwner = String(item.createdBy) === String(req.user._id);
    if (!isAdmin(req.user) && !isOwner) {
      return res.status(403).json({ msg: "You can only edit your own assessment items" });
    }

    // Update fields
    const {
      subject,
      topic,
      subtopic,
      level,
      examBoard,
      type,
      prompt,
      marks,
      correctAnswer,
      markSchemeText,
      options,
      correctIndex,
      difficulty,
      tags,
      isPublished,
    } = req.body;

    if (subject !== undefined) item.subject = subject;
    if (topic !== undefined) item.topic = topic;
    if (subtopic !== undefined) item.subtopic = subtopic;
    if (level !== undefined) item.level = level;
    if (examBoard !== undefined) item.examBoard = examBoard;
    if (type !== undefined) item.type = type;
    if (prompt !== undefined) item.prompt = prompt;
    if (marks !== undefined) item.marks = parseInt(marks);
    if (difficulty !== undefined) item.difficulty = difficulty;
    if (tags !== undefined) item.tags = Array.isArray(tags) ? tags : [];
    if (isPublished !== undefined) {
      item.isPublished = isPublished === true || isPublished === "true";
    }

    // Type-specific fields
    if (type === "short" || correctAnswer !== undefined) {
      if (type === "short" && !correctAnswer && item.type === "short") {
        return res.status(400).json({
          msg: "correctAnswer is required for short answer questions",
        });
      }
      if (correctAnswer !== undefined) item.correctAnswer = correctAnswer;
      if (markSchemeText !== undefined) item.markSchemeText = markSchemeText;
    }

    if (type === "mcq" || options !== undefined || correctIndex !== undefined) {
      if (type === "mcq") {
        if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
          return res.status(400).json({
            msg: "MCQ questions must have 2-6 options",
          });
        }
        item.options = options;
        if (
          !Number.isInteger(correctIndex) ||
          correctIndex < 0 ||
          correctIndex >= options.length
        ) {
          return res.status(400).json({
            msg: "correctIndex must be a valid index for the options array",
          });
        }
        item.correctIndex = correctIndex;
      }
    }

    await item.save();

    return res.json({
      success: true,
      item,
    });
  } catch (err) {
    console.error("Update assessment item error:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ msg: "Validation error", error: err.message });
    }
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   DELETE /api/assessment-items/:id
   - Admin only
   ========================================= */

router.delete("/:id", auth, async (req, res) => {
  try {
    const itemId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ msg: "Invalid assessment item id" });
    }

    // Check authorization: admin only
    if (!isAdmin(req.user)) {
      return res.status(403).json({ msg: "Only admins can delete assessment items" });
    }

    const item = await AssessmentItem.findById(itemId);

    if (!item) {
      return res.status(404).json({ msg: "Assessment item not found" });
    }

    await AssessmentItem.findByIdAndDelete(itemId);

    return res.json({
      success: true,
      msg: "Assessment item deleted successfully",
    });
  } catch (err) {
    console.error("Delete assessment item error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;
