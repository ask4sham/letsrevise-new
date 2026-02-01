// backend/routes/assessmentPapers.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const AssessmentPaper = require("../models/AssessmentPaper");
const AssessmentItem = require("../models/AssessmentItem");
const ExamQuestion = require("../models/ExamQuestion");
const auth = require("../middleware/auth");

console.log("✅ assessmentPapers router file loaded");

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
   HELPER: Normalize items order
   ========================================= */

function normalizeItemsOrder(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  // Sort by order
  const sorted = [...items].sort((a, b) => {
    const orderA = Number(a.order) || 0;
    const orderB = Number(b.order) || 0;
    return orderA - orderB;
  });

  // Normalize order values to 1..n (remove gaps)
  return sorted.map((item, index) => ({
    ...item,
    order: index + 1,
  }));
}

/* =========================================
   HELPER: Compute totalMarks from items
   ========================================= */

async function computeTotalMarks(items) {
  if (!items || items.length === 0) {
    return 0;
  }

  // If all items have marksOverride, sum those
  const allHaveOverride = items.every((item) => item.marksOverride != null);
  if (allHaveOverride) {
    return items.reduce((sum, item) => sum + (item.marksOverride || 0), 0);
  }

  // Otherwise, would need to fetch from AssessmentItem
  // For now, return null to indicate it needs to be computed from populated items
  return null;
}

/* =========================================
   HELPER: Sanitize items for student view
   ========================================= */

function sanitizeItemsForStudent(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(item => {
    // Create a sanitized copy of the item
    const sanitized = { ...item };
    
    // Remove sensitive fields
    delete sanitized.correctIndex;
    delete sanitized.correctIndices; // for multiple correct answers if applicable
    delete sanitized.explanation;
    delete sanitized.answerKey; // if exists
    delete sanitized.modelAnswer; // if exists
    delete sanitized.markingScheme; // if exists
    
    return sanitized;
  });
}

/* =========================================
   GET /api/assessment-papers
   List papers with filters and pagination - RETURN SAFE METADATA ONLY
   ========================================= */

router.get("/", async (req, res) => {
  try {
    const {
      subject,
      examBoard,
      level,
      kind,
      published,
      q, // search query
      page = 1,
      limit = 20,
    } = req.query;

    const user = req.user; // from auth middleware if present (optional for GET)
    const userType = user?.userType;

    // Build query
    const query = {};

    // Visibility: students (or unauthenticated) see only published; teachers/admin see all
    if (!user || isStudent(user)) {
      query.isPublished = true;
    } else if (published !== undefined) {
      query.isPublished = published === "true" || published === true;
    }

    // Filters
    if (subject) {
      query.subject = String(subject).trim();
    }
    if (examBoard) {
      query.examBoard = String(examBoard).trim();
    }
    if (level) {
      query.level = String(level).trim();
    }
    if (kind) {
      query.kind = String(kind).trim();
    }

    // Search in title
    if (q) {
      query.title = { $regex: String(q).trim(), $options: "i" };
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query - select only safe fields
    const total = await AssessmentPaper.countDocuments(query);
    const papers = await AssessmentPaper.find(query)
      .select("_id title subject examBoard level tier kind timeSeconds totalMarks isPublished createdAt items questionBankIds")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Return safe metadata only (NO items array content, correctIndex, explanation)
    const safePapers = papers.map((paper) => ({
      _id: paper._id,
      title: paper.title,
      subject: paper.subject,
      examBoard: paper.examBoard,
      level: paper.level,
      tier: paper.tier,
      kind: paper.kind,
      timeSeconds: paper.timeSeconds,
      totalMarks: paper.totalMarks,
      isPublished: paper.isPublished,
      createdAt: paper.createdAt,
      questionCount: (paper.items?.length || 0) + (paper.questionBankIds?.length || 0),
    }));

    return res.json({
      success: true,
      papers: safePapers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("Error in GET /api/assessment-papers:", err);
    return res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/assessment-papers/:id
   Get single paper by ID with full details
   Students: remove correctIndex and explanation from items
   Teachers/Admin: receive full paper
   ========================================= */

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user; // optional for GET

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid paper ID" });
    }

    // Fetch paper with populated items
    const paper = await AssessmentPaper.findById(id).lean();

    if (!paper) {
      return res.status(404).json({ success: false, msg: "Paper not found" });
    }

    // Visibility check: students (or unauthenticated) see only published
    if ((!user || isStudent(user)) && !paper.isPublished) {
      return res.status(403).json({ success: false, msg: "Access denied" });
    }

    // Check if items need to be populated
    let populatedItems = paper.items;
    
    // If items are just references (contain itemId), we need to populate them
    if (paper.items && paper.items.length > 0 && paper.items[0].itemId) {
      // Extract item IDs from the paper
      const itemIds = paper.items.map(item => item.itemId);
      
      // Fetch all assessment items
      const assessmentItems = await AssessmentItem.find({
        _id: { $in: itemIds }
      }).lean();
      
      // Create a map for quick lookup
      const itemMap = new Map();
      assessmentItems.forEach(item => {
        itemMap.set(String(item._id), item);
      });
      
      // Merge paper item metadata (order, marksOverride) with assessment item data
      populatedItems = paper.items.map(paperItem => {
        const itemId = String(paperItem.itemId);
        const assessmentItem = itemMap.get(itemId);
        
        if (!assessmentItem) {
          // Item not found - return basic structure
          return {
            ...paperItem,
            _id: paperItem.itemId,
            title: "Question",
            question: "Question not found",
            type: "multiple-choice",
            options: [],
            marks: paperItem.marksOverride || 1
          };
        }
        
        // Merge assessment item with paper-specific overrides
        return {
          ...assessmentItem,
          _id: assessmentItem._id,
          order: paperItem.order,
          marksOverride: paperItem.marksOverride,
          marks: paperItem.marksOverride || assessmentItem.marks || 1
        };
      });
      
      // Sort by order
      populatedItems.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    // Merge bank questions (ExamQuestion) into items — same shape as AssessmentItem for attempt/results
    if (paper.questionBankIds && paper.questionBankIds.length > 0) {
      const bankQuestions = await ExamQuestion.find({ _id: { $in: paper.questionBankIds } }).lean();
      const bankMap = new Map(bankQuestions.map((q) => [String(q._id), q]));
      const maxOrder = Array.isArray(populatedItems) && populatedItems.length > 0
        ? Math.max(...populatedItems.map((it) => it.order || 0))
        : 0;
      const       bankItems = paper.questionBankIds
        .map((id, i) => {
          const q = bankMap.get(String(id));
          if (!q) return null;
          return {
            _id: q._id,
            itemId: q._id,
            title: q.topic || (q.question && q.question.slice(0, 50)) || "Question",
            question: q.question,
            type: q.type,
            options: q.options || [],
            marks: q.marks ?? 1,
            correctAnswer: q.correctAnswer,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            order: maxOrder + i + 1,
            source: "bank",
          };
        })
        .filter(Boolean);
      populatedItems = Array.isArray(populatedItems) ? [...populatedItems, ...bankItems] : bankItems;
      populatedItems.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    // Compute totalMarks if not provided
    let totalMarks = paper.totalMarks;
    if (totalMarks == null) {
      totalMarks = await computeTotalMarks(paper.items);
    }

    // Determine if user is a student
    const isStudentUser = !user || isStudent(user);
    
    // Prepare response paper object
    const responsePaper = {
      ...paper,
      totalMarks,
      items: populatedItems || []
    };

    // Sanitize items for student users (remove correctIndex and explanation)
    if (isStudentUser) {
      responsePaper.items = sanitizeItemsForStudent(responsePaper.items);
      responsePaper._sanitizedForStudent = true; // Flag to indicate items were sanitized
    } else {
      responsePaper._sanitizedForStudent = false;
    }

    return res.json({
      success: true,
      paper: responsePaper,
      userType: user?.userType || 'guest',
      accessLevel: isStudentUser ? 'student' : 'teacher_or_admin'
    });
  } catch (err) {
    console.error("Error in GET /api/assessment-papers/:id:", err);
    return res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

/* =========================================
   POST /api/assessment-papers
   Create new paper (teacher/admin only)
   ========================================= */

router.post("/", auth, async (req, res) => {
  try {
    const user = req.user;

    if (!isTeacherOrAdmin(user)) {
      return res.status(403).json({ success: false, msg: "Teacher or admin access required" });
    }

    const {
      kind,
      subject,
      title,
      description,
      examBoard = "AQA",
      level = "GCSE",
      year,
      series,
      paperNumber,
      tier = "mixed",
      timeSeconds = 3600,
      items = [],
      totalMarks,
      isPublished = false,
    } = req.body;

    // Validation
    if (!kind || !["past_paper", "mock_exam", "practice_set"].includes(kind)) {
      return res.status(400).json({ success: false, msg: "Invalid kind" });
    }

    if (!subject || typeof subject !== "string") {
      return res.status(400).json({ success: false, msg: "Subject is required" });
    }

    if (!title || typeof title !== "string") {
      return res.status(400).json({ success: false, msg: "Title is required" });
    }

    // Validate items
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, msg: "Items must be an array" });
    }

    // Validate each item
    for (const item of items) {
      if (!item.itemId || !mongoose.Types.ObjectId.isValid(item.itemId)) {
        return res.status(400).json({ success: false, msg: "Invalid itemId in items" });
      }
      if (typeof item.order !== "number" || item.order < 1) {
        return res.status(400).json({ success: false, msg: "Invalid order in items (must be integer >= 1)" });
      }
      if (item.marksOverride != null && (typeof item.marksOverride !== "number" || item.marksOverride < 1)) {
        return res.status(400).json({ success: false, msg: "Invalid marksOverride (must be integer >= 1)" });
      }
    }

    // Check for duplicate itemIds
    const itemIds = items.map((item) => String(item.itemId));
    const uniqueItemIds = new Set(itemIds);
    if (itemIds.length !== uniqueItemIds.size) {
      return res.status(400).json({ success: false, msg: "Duplicate itemId found in items" });
    }

    // Normalize items order
    const normalizedItems = normalizeItemsOrder(items);

    // Determine createdByRole
    const createdByRole = isAdmin(user) ? "admin" : "teacher";

    // Create paper
    const paper = await AssessmentPaper.create({
      createdBy: user.userId || user._id,
      createdByRole,
      isPublished: !!isPublished,
      kind,
      examBoard: String(examBoard).trim(),
      subject: String(subject).trim(),
      level: String(level).trim(),
      title: String(title).trim(),
      description: description ? String(description).trim() : undefined,
      year: year != null ? Number(year) : undefined,
      series: series ? String(series).trim() : undefined,
      paperNumber: paperNumber ? String(paperNumber).trim() : undefined,
      tier,
      timeSeconds: Number(timeSeconds) || 3600,
      items: normalizedItems,
      totalMarks: totalMarks != null ? Number(totalMarks) : undefined,
    });

    // Compute totalMarks if not provided
    let finalTotalMarks = paper.totalMarks;
    if (finalTotalMarks == null) {
      finalTotalMarks = await computeTotalMarks(paper.items);
    }

    return res.status(201).json({
      success: true,
      paper: {
        ...paper.toObject(),
        totalMarks: finalTotalMarks,
      },
    });
  } catch (err) {
    console.error("Error in POST /api/assessment-papers:", err);
    if (err.message && err.message.includes("Duplicate itemId")) {
      return res.status(400).json({ success: false, msg: err.message });
    }
    return res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

/* =========================================
   PUT /api/assessment-papers/:id
   Update paper (teacher can edit own; admin can edit any)
   ========================================= */

router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!isTeacherOrAdmin(user)) {
      return res.status(403).json({ success: false, msg: "Teacher or admin access required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid paper ID" });
    }

    const paper = await AssessmentPaper.findById(id);

    if (!paper) {
      return res.status(404).json({ success: false, msg: "Paper not found" });
    }

    // Permission check: teacher can only edit own papers
    if (isTeacher(user) && !isAdmin(user)) {
      const paperCreatorId = String(paper.createdBy);
      const userId = String(user.userId || user._id);
      if (paperCreatorId !== userId) {
        return res.status(403).json({ success: false, msg: "You can only edit your own papers" });
      }
    }

    const {
      kind,
      subject,
      title,
      description,
      examBoard,
      level,
      year,
      series,
      paperNumber,
      tier,
      timeSeconds,
      items,
      totalMarks,
      isPublished,
    } = req.body;

    // Update fields if provided
    if (kind !== undefined) {
      if (!["past_paper", "mock_exam", "practice_set"].includes(kind)) {
        return res.status(400).json({ success: false, msg: "Invalid kind" });
      }
      paper.kind = kind;
    }

    if (subject !== undefined) {
      if (typeof subject !== "string" || !subject.trim()) {
        return res.status(400).json({ success: false, msg: "Subject must be a non-empty string" });
      }
      paper.subject = String(subject).trim();
    }

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ success: false, msg: "Title must be a non-empty string" });
      }
      paper.title = String(title).trim();
    }

    if (description !== undefined) {
      paper.description = description ? String(description).trim() : undefined;
    }

    if (examBoard !== undefined) {
      paper.examBoard = String(examBoard).trim();
    }

    if (level !== undefined) {
      paper.level = String(level).trim();
    }

    if (year !== undefined) {
      paper.year = year != null ? Number(year) : undefined;
    }

    if (series !== undefined) {
      paper.series = series ? String(series).trim() : undefined;
    }

    if (paperNumber !== undefined) {
      paper.paperNumber = paperNumber ? String(paperNumber).trim() : undefined;
    }

    if (tier !== undefined) {
      if (!["foundation", "higher", "mixed"].includes(tier)) {
        return res.status(400).json({ success: false, msg: "Invalid tier" });
      }
      paper.tier = tier;
    }

    if (timeSeconds !== undefined) {
      paper.timeSeconds = Number(timeSeconds) || 3600;
    }

    if (isPublished !== undefined) {
      paper.isPublished = !!isPublished;
    }

    if (totalMarks !== undefined) {
      paper.totalMarks = totalMarks != null ? Number(totalMarks) : undefined;
    }

    // Update items if provided
    if (items !== undefined) {
      if (!Array.isArray(items)) {
        return res.status(400).json({ success: false, msg: "Items must be an array" });
      }

      // Validate each item
      for (const item of items) {
        if (!item.itemId || !mongoose.Types.ObjectId.isValid(item.itemId)) {
          return res.status(400).json({ success: false, msg: "Invalid itemId in items" });
        }
        if (typeof item.order !== "number" || item.order < 1) {
          return res.status(400).json({ success: false, msg: "Invalid order in items (must be integer >= 1)" });
        }
        if (item.marksOverride != null && (typeof item.marksOverride !== "number" || item.marksOverride < 1)) {
          return res.status(400).json({ success: false, msg: "Invalid marksOverride (must be integer >= 1)" });
        }
      }

      // Check for duplicate itemIds
      const itemIds = items.map((item) => String(item.itemId));
      const uniqueItemIds = new Set(itemIds);
      if (itemIds.length !== uniqueItemIds.size) {
        return res.status(400).json({ success: false, msg: "Duplicate itemId found in items" });
      }

      // Normalize items order
      paper.items = normalizeItemsOrder(items);
    }

    await paper.save();

    // Compute totalMarks if not provided
    let finalTotalMarks = paper.totalMarks;
    if (finalTotalMarks == null) {
      finalTotalMarks = await computeTotalMarks(paper.items);
    }

    return res.json({
      success: true,
      paper: {
        ...paper.toObject(),
        totalMarks: finalTotalMarks,
      },
    });
  } catch (err) {
    console.error("Error in PUT /api/assessment-papers/:id:", err);
    if (err.message && err.message.includes("Duplicate itemId")) {
      return res.status(400).json({ success: false, msg: err.message });
    }
    return res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

/* =========================================
   PATCH /api/assessment-papers/:id/questions
   Add/remove exam question bank refs (teacher only)
   ========================================= */

router.patch("/:id/questions", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!isTeacherOrAdmin(user)) {
      return res.status(403).json({ success: false, msg: "Teacher or admin access required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid paper ID" });
    }

    const paper = await AssessmentPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ success: false, msg: "Paper not found" });
    }

    if (isTeacher(user) && !isAdmin(user)) {
      const paperCreatorId = String(paper.createdBy);
      const userId = String(user.userId || user._id);
      if (paperCreatorId !== userId) {
        return res.status(403).json({ success: false, msg: "You can only edit your own papers" });
      }
    }

    const { addExamQuestionIds = [], removeExamQuestionIds = [] } = req.body;
    if (!Array.isArray(addExamQuestionIds) || !Array.isArray(removeExamQuestionIds)) {
      return res.status(400).json({ success: false, msg: "addExamQuestionIds and removeExamQuestionIds must be arrays" });
    }

    const toAdd = addExamQuestionIds
      .filter((sid) => mongoose.Types.ObjectId.isValid(String(sid)))
      .map((sid) => mongoose.Types.ObjectId(sid));
    const toRemove = new Set(removeExamQuestionIds.map((sid) => String(sid)));

    let bankIds = Array.isArray(paper.questionBankIds) ? paper.questionBankIds.map((oid) => String(oid)) : [];
    bankIds = bankIds.filter((oid) => !toRemove.has(oid));
    const existing = new Set(bankIds);
    toAdd.forEach((oid) => {
      const s = String(oid);
      if (!existing.has(s)) {
        existing.add(s);
        bankIds.push(s);
      }
    });

    paper.questionBankIds = bankIds.map((sid) => mongoose.Types.ObjectId(sid));
    await paper.save();

    return res.json({
      success: true,
      paper: { _id: paper._id, questionBankIds: paper.questionBankIds },
    });
  } catch (err) {
    console.error("Error in PATCH /api/assessment-papers/:id/questions:", err);
    return res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

/* =========================================
   DELETE /api/assessment-papers/:id
   Delete paper (admin only)
   ========================================= */

router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!isAdmin(user)) {
      return res.status(403).json({ success: false, msg: "Admin access required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid paper ID" });
    }

    const paper = await AssessmentPaper.findById(id);

    if (!paper) {
      return res.status(404).json({ success: false, msg: "Paper not found" });
    }

    await AssessmentPaper.findByIdAndDelete(id);

    return res.json({
      success: true,
      msg: "Paper deleted successfully",
    });
  } catch (err) {
    console.error("Error in DELETE /api/assessment-papers/:id:", err);
    return res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

module.exports = router;