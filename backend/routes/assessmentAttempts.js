// backend/routes/assessmentAttempts.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const AssessmentAttempt = require("../models/AssessmentAttempt");
const AssessmentPaper = require("../models/AssessmentPaper");
const AssessmentItem = require("../models/AssessmentItem");
const auth = require("../middleware/auth");

console.log("✅ assessmentAttempts router file loaded");

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
   FUZZY MATCHING HELPER FUNCTIONS
   ========================================= */

function normaliseShortText(s = "") {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")  // remove punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// very small typo tolerance: 1 edit distance
function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function tokenise(s) {
  const stop = new Set([
    "a","an","the","and","or","but",
    "is","are","was","were","be","been","being",
    "have","has","had","do","does","did",
    "of","to","in","on","for","with",
    "cells","cell"
    // "not", "no", and "without" REMOVED from stopwords - they are important for negation detection
  ]);

  return normaliseShortText(s)
    .split(" ")
    .filter(Boolean)
    .filter(t => t.length > 1)      // drop 1-letter junk
    .filter(t => !stop.has(t));     // drop filler words
}

function fuzzyHasToken(userTokens, targetToken) {
  // exact OR very close spelling (<=1 edit)
  return userTokens.some(t => t === targetToken || levenshtein(t, targetToken) <= 1);
}

function hasNegationNear(words, idx, window = 3) {
  const start = Math.max(0, idx - window);
  const end = Math.min(words.length - 1, idx + window);
  const neg = new Set([
    "no", "not", 
    "dont", "don't", 
    "doesnt", "doesn't", "didnt", "didn't",
    "cant", "can't", "cannot",
    "wont", "won't",
    "without", "lack", "lacks"
  ]);
  for (let i = start; i <= end; i++) {
    if (neg.has(words[i])) return true;
  }
  return false;
}

function anyFuzzyIndex(words, targets) {
  // return first index where word ~ any target, else -1
  for (let i = 0; i < words.length; i++) {
    for (const t of targets) {
      if (words[i] === t || levenshtein(words[i], t) <= 1) return i;
    }
  }
  return -1;
}

function isShortAnswerCorrect(userText, correctText) {
  const uTokens = tokenise(userText);
  const cTokens = tokenise(correctText);

  if (uTokens.length === 0) return false;

  // --- 1) Keep your existing overlap idea (typo-tolerant) ---
  let hit = 0;
  const cSet = new Set(cTokens);
  for (const ct of cSet) {
    if (fuzzyHasToken(uTokens, ct)) hit++;
  }
  const overlap = hit / Math.max(1, cSet.size);

  // If overlap is very low, definitely wrong
  if (overlap < 0.45) return false;

  // --- 2) Minimal "meaning" guard for common biology definition pattern ---
  // If model answer mentions BOTH eukaryotic + prokaryotic + nucleus,
  // require that student assigns the negation to the correct one.
  const cHasEuk = cTokens.includes("eukaryotic") || cTokens.includes("eukaryote");
  const cHasPro = cTokens.includes("prokaryotic") || cTokens.includes("prokaryote");
  const cHasNucleus = cTokens.includes("nucleus") || cTokens.includes("nuclei");

  if (cHasEuk && cHasPro && cHasNucleus) {
    // Find where "eukaryotic" and "prokaryotic" appear in student answer
    const eIdx = anyFuzzyIndex(uTokens, ["eukaryotic", "eukaryote"]);
    const pIdx = anyFuzzyIndex(uTokens, ["prokaryotic", "prokaryote", "prokaryotics", "prokaryotes"]);
    const nIdx = anyFuzzyIndex(uTokens, ["nucleus", "nuclei"]);

    // Must mention all three somewhere
    if (eIdx === -1 || pIdx === -1 || nIdx === -1) return false;

    // Decide expected truth from model answer:
    // "eukaryotic ... nucleus" (no negation near nucleus) AND
    // "prokaryotic ... not/no/without ... nucleus" (negation near nucleus)
    // We'll infer expected by checking negation near "nucleus" in the model answer too.
    const cWords = cTokens;
    const cNIdx = anyFuzzyIndex(cWords, ["nucleus", "nuclei"]);
    const modelNegNearNucleus = cNIdx !== -1 ? hasNegationNear(cWords, cNIdx, 4) : false;

    // For this specific canonical question, model is usually:
    // eukaryotic HAVE nucleus, prokaryotic DO NOT.
    // If modelNegNearNucleus is true, still treat it as "prokaryotic no nucleus" pattern.
    // Student must have: prokaryotic negated somewhere near nucleus, and eukaryotic not negated.
    const studentNegNearNucleus = hasNegationNear(uTokens, nIdx, 4);

    // If student negates nucleus but doesn't clearly separate subjects,
    // we use proximity: look for negation near eukaryotic and prokaryotic separately.
    // Find a negation token position in the student answer
    const negIdx = anyFuzzyIndex(uTokens, [
      "not", "no", "without",
      "dont", "don't", 
      "doesnt", "doesn't", "didnt", "didn't",
      "cant", "can't", "cannot",
      "wont", "won't",
      "lack", "lacks"
    ]);

    // If there is negation, it must be closer to "prokaryotic" than "eukaryotic"
    // (prevents the window-based false negative you're seeing)
    if (negIdx !== -1) {
      const dPro = Math.abs(negIdx - pIdx);
      const dEuk = Math.abs(negIdx - eIdx);
      if (dEuk < dPro) return false; // negation attached to eukaryotic => reversed
    }

    // Still require that prokaryotic is the one negated (or negation is near nucleus)
    const negNearPro = hasNegationNear(uTokens, pIdx, 6);
    if (!negNearPro && !studentNegNearNucleus) return false;
  }

  // --- 3) Final accept rule ---
  return overlap >= 0.6;
}

/* =========================================
   POST /api/assessment-attempts
   Create a new attempt for a student to start a paper
   ========================================= */

router.post("/", auth, async (req, res) => {
  try {
    const user = req.user;

    // Only students can create attempts
    if (!isStudent(user)) {
      return res.status(403).json({
        success: false,
        msg: "Only students can start assessment attempts",
      });
    }

    const studentId = user.userId || user._id;
    const { paperId } = req.body;

    // Validate paperId
    if (!paperId || !mongoose.Types.ObjectId.isValid(paperId)) {
      return res.status(400).json({
        success: false,
        msg: "Valid paperId is required",
      });
    }

    // Check if paper exists and is published
    const paper = await AssessmentPaper.findById(paperId)
      .select("isPublished timeSeconds durationSeconds items")
      .lean();

    if (!paper) {
      return res.status(404).json({
        success: false,
        msg: "Assessment paper not found",
      });
    }

    // Students can only access published papers
    if (!paper.isPublished && !isTeacherOrAdmin(user)) {
      return res.status(403).json({
        success: false,
        msg: "This assessment paper is not available",
      });
    }

    // If you added the unique partial index, this query is optional,
    // but keeps it for nicer UX.
    const existingAttempt = await AssessmentAttempt.findOne({
      studentId,
      paperId,
      status: "in_progress",
    }).lean();

    if (existingAttempt) {
      return res.json({
        success: true,
        attempt: {
          _id: existingAttempt._id,
          paperId: existingAttempt.paperId,
          startedAt: existingAttempt.startedAt,
          durationSeconds: existingAttempt.durationSeconds,
          timeUsedSeconds: existingAttempt.timeUsedSeconds ?? 0,
          status: existingAttempt.status,
          existing: true,
        },
      });
    }

    const durationSeconds = paper.timeSeconds ?? paper.durationSeconds;
    if (!durationSeconds) {
      return res.status(500).json({
        success: false,
        msg: "Paper has no duration configured",
      });
    }

    const attempt = await AssessmentAttempt.create({
      studentId,
      paperId,
      status: "in_progress",
      startedAt: new Date(),
      durationSeconds,
      timeUsedSeconds: 0,
      answers: [],
      autoSubmitted: false,
      score: {
        totalQuestions: paper.items?.length || 0,
        answered: 0,
        correct: 0,
        percentage: 0,
      },
    });

    return res.status(201).json({
      success: true,
      attempt: {
        _id: attempt._id,
        paperId: attempt.paperId,
        startedAt: attempt.startedAt,
        durationSeconds: attempt.durationSeconds,
        timeUsedSeconds: attempt.timeUsedSeconds,
        status: attempt.status,
        totalQuestions: paper.items?.length || 0,
      },
    });
  } catch (err) {
    // If you have the unique partial index, handle duplicate gracefully
    if (err && err.code === 11000) {
      return res.status(409).json({
        success: false,
        msg: "You already have an in-progress attempt for this paper",
      });
    }

    console.error("Error in POST /api/assessment-attempts:", err);
    return res.status(500).json({
      success: false,
      msg: "Server error",
      error: err.message,
    });
  }
});

/* =========================================
   GET /api/assessment-attempts
   Get attempts for the current user (student) or all attempts (teacher/admin)
   ========================================= */

router.get("/", auth, async (req, res) => {
  try {
    const user = req.user;
    const { paperId, status, studentId } = req.query;

    let query = {};

    // Students can only see their own attempts
    if (isStudent(user)) {
      query.studentId = user.userId || user._id;
    }
    // Teachers can see attempts for papers they created or all if admin
    else if (isTeacher(user) && !isAdmin(user)) {
      // For teachers, we need to check if they created the paper
      // This requires a more complex query or post-filtering
      query.studentId = user.userId || user._id; // Default to own for now
    }
    // Admins can see all or filter by studentId
    else if (isAdmin(user) && studentId) {
      if (mongoose.Types.ObjectId.isValid(studentId)) {
        query.studentId = studentId;
      }
    }

    // Filter by paperId
    if (paperId && mongoose.Types.ObjectId.isValid(paperId)) {
      query.paperId = paperId;
    }

    // Filter by status - UPDATED to new statuses
    if (status && ["in_progress", "submitted", "expired"].includes(status)) {
      query.status = status;
    }

    const attempts = await AssessmentAttempt.find(query)
      .sort({ startedAt: -1 })
      .populate("paperId", "title subject examBoard level") // Metadata only, no items
      .populate("studentId", "name email")
      .lean();

    return res.json({
      success: true,
      attempts: attempts.map((attempt) => ({
        _id: attempt._id,
        paperId: attempt.paperId,
        studentId: attempt.studentId,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt, // UPDATED: completedAt → submittedAt
        durationSeconds: attempt.durationSeconds,
        timeUsedSeconds: attempt.timeUsedSeconds, // ADDED: timeUsedSeconds
        score: attempt.score,
        autoSubmitted: attempt.autoSubmitted,
        paper: attempt.paperId, // Already populated with metadata only
        student: isTeacherOrAdmin(user) ? attempt.studentId : undefined,
      })),
    });
  } catch (err) {
    console.error("Error in GET /api/assessment-attempts:", err);
    return res.status(500).json({
      success: false,
      msg: "Server error",
      error: err.message,
    });
  }
});

/* =========================================
   GET /api/assessment-attempts/in-progress/:paperId
   Resume endpoint - find student's in-progress attempt for a specific paper
   ========================================= */

router.get("/in-progress/:paperId", auth, async (req, res) => {
  try {
    const user = req.user;

    if (!isStudent(user)) {
      return res.status(403).json({ success: false, msg: "Only students can access in-progress attempts" });
    }

    const studentId = user.userId || user._id;
    const { paperId } = req.params;

    if (!paperId || !mongoose.Types.ObjectId.isValid(paperId)) {
      return res.status(400).json({ success: false, msg: "Valid paperId is required" });
    }

    const attempt = await AssessmentAttempt.findOne({
      studentId,
      paperId,
      status: "in_progress",
    })
      .select("_id paperId status startedAt durationSeconds timeUsedSeconds")
      .lean();

    if (!attempt) {
      return res.status(404).json({ success: false, msg: "No in-progress attempt" });
    }

    return res.json({ success: true, attempt });
  } catch (err) {
    console.error("Error in GET /api/assessment-attempts/in-progress/:paperId:", err);
    return res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/assessment-attempts/:id
   Get specific attempt by ID
   Students: safe attempt data only (no paper items)
   Teachers/Admin: full details
   ========================================= */

router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        msg: "Invalid attempt ID",
      });
    }

    // Determine if user is teacher/admin
    const canViewAsTeacherAdmin = isTeacherOrAdmin(user);

    // Populate differently based on user role
    let attempt;
    if (canViewAsTeacherAdmin) {
      // Teachers/Admins get full paper details with items
      attempt = await AssessmentAttempt.findById(id)
        .populate("paperId", "title subject examBoard level timeSeconds items")
        .populate("studentId", "name email")
        .lean();
    } else {
      // Students get only safe paper metadata (NO items)
      attempt = await AssessmentAttempt.findById(id)
        .populate("paperId", "title subject examBoard level timeSeconds")
        .populate("studentId", "name email")
        .lean();
    }

    if (!attempt) {
      return res.status(404).json({
        success: false,
        msg: "Attempt not found",
      });
    }

    // Permission check
    const isAttemptOwner = String(attempt.studentId._id) === String(user.userId || user._id);
    const canView = isAttemptOwner || canViewAsTeacherAdmin;

    if (!canView) {
      return res.status(403).json({
        success: false,
        msg: "Access denied",
      });
    }

    // Prepare response based on user role
    const response = {
      success: true,
      attempt: {
        _id: attempt._id,
        paperId: attempt.paperId,
        studentId: attempt.studentId,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        durationSeconds: attempt.durationSeconds,
        timeUsedSeconds: attempt.timeUsedSeconds,
        answers: attempt.answers,
        score: attempt.score,
        autoSubmitted: attempt.autoSubmitted,
      },
    };

    // Add paper details (safe metadata for students, full for teachers/admins)
    if (attempt.paperId) {
      response.attempt.paper = {
        _id: attempt.paperId._id,
        title: attempt.paperId.title,
        subject: attempt.paperId.subject,
        examBoard: attempt.paperId.examBoard,
        level: attempt.paperId.level,
        timeSeconds: attempt.paperId.timeSeconds,
      };

      // Only include items for teachers/admins
      if (canViewAsTeacherAdmin && attempt.paperId.items) {
        response.attempt.paper.items = attempt.paperId.items;
      }
    }

    // Add student details only for teachers/admins
    if (canViewAsTeacherAdmin && attempt.studentId) {
      response.attempt.student = attempt.studentId;
    }

    return res.json(response);
  } catch (err) {
    console.error("Error in GET /api/assessment-attempts/:id:", err);
    return res.status(500).json({
      success: false,
      msg: "Server error",
      error: err.message,
    });
  }
});

/* =========================================
   PUT /api/assessment-attempts/:id/answer
   Update answer for a specific question
   ========================================= */

router.put("/:id/answer", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const studentId = user.userId || user._id;

    let { questionId, selectedIndex, textAnswer, timeUsedSeconds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid attempt ID" });
    }

    if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({ success: false, msg: "Valid questionId is required" });
    }

    if (timeUsedSeconds !== undefined && (typeof timeUsedSeconds !== "number" || timeUsedSeconds < 0)) {
      return res.status(400).json({
        success: false,
        msg: "timeUsedSeconds must be a non-negative number",
      });
    }

    const attempt = await AssessmentAttempt.findById(id);
    if (!attempt) {
      return res.status(404).json({ success: false, msg: "Attempt not found" });
    }

    // Only the owner can update
    if (String(attempt.studentId) !== String(studentId)) {
      return res.status(403).json({ success: false, msg: "You can only update your own attempts" });
    }

    // ✅ FINAL LOCK: Hard-fail if attempt is not in_progress
    if (attempt.status !== "in_progress") {
      return res.status(409).json({
        success: false,
        msg: "Attempt is already submitted",
      });
    }

    // ✅ GUARDRAIL: Clamp timeUsedSeconds to prevent invalid values
    if (timeUsedSeconds !== undefined) {
      // Prevent time from exceeding duration
      const clampedToDuration = Math.min(timeUsedSeconds, attempt.durationSeconds);
      // Prevent time travel (can't go backwards)
      attempt.timeUsedSeconds = Math.max(attempt.timeUsedSeconds, clampedToDuration);
    }

    // Determine question type (MCQ vs short)
    const item = await AssessmentItem.findById(questionId).select("type options").lean();
    
    if (!item) {
      return res.status(404).json({ success: false, msg: "Assessment item not found" });
    }

    // ✅ HARD RULE: short-answer questions must NEVER validate selectedIndex
    if (item.type === "short") {
      selectedIndex = null;
    }

    const itemType = item.type;
    const isShort = itemType === "short";
    const isMcq =
      itemType === "mcq" ||
      itemType === "multiple_choice" ||
      itemType === "multiple-choice" ||
      itemType === "multiple-choice-single" ||
      itemType === "multiple-choice-single-answer";

    if (!isShort && !isMcq) {
      // Keep system safe: if new types appear, don't accept unknown payloads silently.
      return res.status(400).json({ success: false, msg: `Unsupported question type: ${itemType}` });
    }

    // Validate per type
    if (isMcq) {
      // selectedIndex may be null (unanswered)
      if (selectedIndex !== null && selectedIndex !== undefined) {
        if (typeof selectedIndex !== "number" || selectedIndex < 0) {
          return res.status(400).json({
            success: false,
            msg: "selectedIndex must be null or a non-negative number",
          });
        }
        // Optional but safer: ensure index is in range if options exist
        if (Array.isArray(item.options) && item.options.length > 0 && selectedIndex >= item.options.length) {
          return res.status(400).json({
            success: false,
            msg: "selectedIndex is out of range for this question",
          });
        }
      }
    }

    if (isShort) {
      // textAnswer can be null/undefined to clear
      if (textAnswer !== null && textAnswer !== undefined && typeof textAnswer !== "string") {
        return res.status(400).json({
          success: false,
          msg: "textAnswer must be a string or null",
        });
      }
    }

    const normalizedTextAnswer =
      typeof textAnswer === "string" ? textAnswer.trim() : textAnswer === null ? null : undefined;

    // Upsert by questionId
    const existing = attempt.answers.find((a) => String(a.questionId) === String(questionId));

    if (existing) {
      // Preserve legacy field for MCQ and add new field for short
      if (isMcq) {
        existing.selectedIndex = selectedIndex ?? null;
        existing.textAnswer = null; // keep mutually exclusive
      } else {
        existing.textAnswer = normalizedTextAnswer ?? null;
        existing.selectedIndex = null; // keep mutually exclusive
      }
      existing.answeredAt = new Date();
    } else {
      attempt.answers.push({
        questionId,
        selectedIndex: isMcq ? (selectedIndex ?? null) : null,
        textAnswer: isShort ? (normalizedTextAnswer ?? null) : null,
        answeredAt: new Date(),
      });
    }

    await attempt.save();

    return res.json({
      success: true,
      attempt: {
        _id: attempt._id,
        status: attempt.status,
        timeUsedSeconds: attempt.timeUsedSeconds,
        answers: attempt.answers,
      },
    });
  } catch (err) {
    console.error("Error in PUT /api/assessment-attempts/:id/answer:", err);
    return res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

/* =========================================
   POST /api/assessment-attempts/:id/submit
   Submit an attempt (compute score and mark as submitted/expired)
   Short answers: now use fuzzy matching instead of exact
   ========================================= */

router.post("/:id/submit", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const studentId = user.userId || user._id;

    const { autoSubmitted = false, timeUsedSeconds } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid attempt ID" });
    }

    if (timeUsedSeconds !== undefined && (typeof timeUsedSeconds !== "number" || timeUsedSeconds < 0)) {
      return res.status(400).json({ success: false, msg: "timeUsedSeconds must be a non-negative number" });
    }

    const attempt = await AssessmentAttempt.findById(id);
    if (!attempt) {
      return res.status(404).json({ success: false, msg: "Attempt not found" });
    }

    // Only owner can submit
    if (String(attempt.studentId) !== String(studentId)) {
      return res.status(403).json({ success: false, msg: "You can only submit your own attempts" });
    }

    if (attempt.status !== "in_progress") {
      return res.status(400).json({ success: false, msg: "Attempt is already submitted" });
    }

    // ✅ SUBMISSION GUARDRAIL: Ensure timeUsedSeconds is valid
    let finalTimeUsedSeconds;

    if (timeUsedSeconds !== undefined) {
      // Apply same clamp logic as the answer endpoint
      const clampedToDuration = Math.min(timeUsedSeconds, attempt.durationSeconds);
      finalTimeUsedSeconds = Math.max(attempt.timeUsedSeconds, clampedToDuration);
    } else {
      // Compute from startedAt
      const elapsed = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
      finalTimeUsedSeconds = Math.min(elapsed, attempt.durationSeconds);
      // Ensure time doesn't go backwards
      finalTimeUsedSeconds = Math.max(attempt.timeUsedSeconds, finalTimeUsedSeconds);
    }

    attempt.timeUsedSeconds = finalTimeUsedSeconds;

    // Load paper with populated items to get full question data including options and correctAnswer
    const paper = await AssessmentPaper.findById(attempt.paperId)
      .populate({
        path: "items.itemId",
        select: "type options correctAnswer correctIndex content",
      })
      .select("items")
      .lean();

    if (!paper) {
      return res.status(404).json({ success: false, msg: "Paper not found" });
    }

    const totalQuestions = (paper.items || []).length;

    let answered = 0;
    let correct = 0;

    // Process each item in the paper to calculate score
    for (const wrapper of paper.items || []) {
      const itemDoc = wrapper.itemId;
      if (!itemDoc) continue;

      const itemIdStr = String(itemDoc._id); // actual AssessmentItem _id

      // Find the user's answer for this question
      const userAnswer = attempt.answers.find((a) => String(a.questionId) === itemIdStr);

      // For new types, we need to check if answer exists
      if (!userAnswer) continue;

      const itemType = itemDoc.type;

      // === HANDLE SHORT ANSWER ===
      if (itemType === "short") {
        const userText = userAnswer.textAnswer;
        // unanswered if null/empty
        if (userText === null || userText === undefined || String(userText).trim() === "") {
          continue;
        }

        answered += 1;

        // ✅ FUZZY MATCHING (changed from exact match)
        const isCorrect = isShortAnswerCorrect(userText, itemDoc.correctAnswer);
        
        if (isCorrect) {
          correct += 1;
        }
        continue;
      }

      // === HANDLE MCQ ===
      if (itemType === "mcq" || itemType === "multiple-choice") {
        if (userAnswer.selectedIndex === null || userAnswer.selectedIndex === undefined) {
          continue;
        }

        answered += 1;

        // Find the index of correctAnswer in the options array
        let correctAnswerIndex = -1;

        if (itemDoc.correctAnswer !== undefined && itemDoc.correctAnswer !== null) {
          // If we have the actual AssessmentItem document with correctAnswer
          if (Array.isArray(itemDoc.options)) {
            correctAnswerIndex = itemDoc.options.findIndex((opt) => opt === itemDoc.correctAnswer);
          }
        }

        // If we couldn't find correctAnswer in options or no correctAnswer field, try correctIndex
        if (correctAnswerIndex === -1 && typeof itemDoc.correctIndex === "number") {
          correctAnswerIndex = itemDoc.correctIndex;
        }

        // Check if the selectedIndex matches the correct answer index
        if (correctAnswerIndex !== -1 && userAnswer.selectedIndex === correctAnswerIndex) {
          correct += 1;
        }
        continue;
      }

      // === HANDLE NEW QUESTION TYPES: label, table, data ===
      if (itemType === "label" || itemType === "table" || itemType === "data") {
        // For these types, we need to check if user provided an answer
        // They should have textAnswer (for label/table/data input) or selectedIndex
        const hasTextAnswer = userAnswer.textAnswer !== null && 
                              userAnswer.textAnswer !== undefined && 
                              String(userAnswer.textAnswer).trim() !== "";
        
        const hasSelectedIndex = userAnswer.selectedIndex !== null && 
                                userAnswer.selectedIndex !== undefined;

        if (!hasTextAnswer && !hasSelectedIndex) {
          // No answer provided
          continue;
        }

        answered += 1;

        // For now, these types are NOT auto-graded
        // They will be marked as incorrect by default (0 marks)
        // Teachers will need to manually grade these in the future
        // correct += 0; // Already 0 by default
        
        continue;
      }

      // === HANDLE LEGACY TYPES ===
      if (itemType === "short-answer" || itemType === "essay" || 
          itemType === "problem-solving" || itemType === "practical" || 
          itemType === "other") {
        // These are not auto-graded, count as answered but not correct
        const hasTextAnswer = userAnswer.textAnswer !== null && 
                              userAnswer.textAnswer !== undefined && 
                              String(userAnswer.textAnswer).trim() !== "";
        
        const hasSelectedIndex = userAnswer.selectedIndex !== null && 
                                userAnswer.selectedIndex !== undefined;

        if (hasTextAnswer || hasSelectedIndex) {
          answered += 1;
          // Not auto-graded, so no increment to correct
        }
        continue;
      }
    }

    const percentage = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;

    attempt.status = autoSubmitted ? "expired" : "submitted";
    attempt.submittedAt = new Date();
    attempt.autoSubmitted = !!autoSubmitted;

    attempt.score = {
      totalQuestions,
      answered,
      correct,
      percentage,
    };

    await attempt.save();

    return res.json({
      success: true,
      attempt: {
        _id: attempt._id,
        paperId: attempt.paperId,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        timeUsedSeconds: attempt.timeUsedSeconds,
        score: attempt.score,
      },
    });
  } catch (err) {
    console.error("Error in POST /api/assessment-attempts/:id/submit:", err);
    return res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/assessment-attempts/:id/results
   Get detailed results for a submitted attempt (includes question details)
   Short answers: now use fuzzy matching instead of exact
   ========================================= */

router.get("/:id/results", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        msg: "Invalid attempt ID",
      });
    }

    const attempt = await AssessmentAttempt.findById(id)
      .populate("paperId", "title subject examBoard level tier kind timeSeconds")
      .lean();

    if (!attempt) {
      return res.status(404).json({
        success: false,
        msg: "Attempt not found",
      });
    }

    // Permission check
    const isAttemptOwner = String(attempt.studentId) === String(user.userId || user._id);
    const canViewAsTeacherAdmin = isTeacherOrAdmin(user);

    if (!isAttemptOwner && !canViewAsTeacherAdmin) {
      return res.status(403).json({
        success: false,
        msg: "Access denied",
      });
    }

    // Only show results for submitted/expired attempts
    if (attempt.status === "in_progress") {
      return res.status(400).json({
        success: false,
        msg: "Attempt is still in progress",
      });
    }

    // Get paper with populated items to fetch question details
    const paper = await AssessmentPaper.findById(attempt.paperId)
      .populate({
        path: "items.itemId",
        select: "title question type options marks explanation correctAnswer correctIndex",
      })
      .select("items")
      .lean();

    if (!paper) {
      return res.status(404).json({
        success: false,
        msg: "Paper not found",
      });
    }

    // Sort items by order (assuming paper.items has order field)
    const sortedItems = [...(paper.items || [])].sort((a, b) => {
      // Find order from paper items array
      const itemA = paper.items?.find((item) => String(item._id) === String(a._id));
      const itemB = paper.items?.find((item) => String(item._id) === String(b._id));
      const orderA = itemA?.order || 0;
      const orderB = itemB?.order || 0;
      return orderA - orderB;
    });

    // Create a map of attempt answers by questionId for quick lookup
    const answerMap = new Map();
    (attempt.answers || []).forEach((answer) => {
      answerMap.set(String(answer.questionId), answer);
    });

    // Build detailed question results
    const questionResults = sortedItems.map((wrapper, index) => {
      const itemDoc = wrapper.itemId;
      if (!itemDoc) {
        return {
          _id: wrapper._id,
          itemId: null,
          title: `Question ${index + 1}`,
          question: "",
          type: "unknown",
          options: [],
          marks: itemDoc?.marks || 1,
          correctAnswer: null, // Added correctAnswer field
          correctIndex: -1,
          explanation: "",
          userAnswer: null,
          isCorrect: false,
        };
      }

      const itemIdStr = String(itemDoc._id); // actual AssessmentItem _id
      const answer = answerMap.get(itemIdStr);

      // Short answer result shape
      if (itemDoc.type === "short") {
        const userText = answer?.textAnswer ?? null;
        
        // ✅ FUZZY MATCHING (changed from exact match)
        const isCorrect =
          userText !== null &&
          userText !== undefined &&
          String(userText).trim() !== "" &&
          isShortAnswerCorrect(userText, itemDoc.correctAnswer);

        return {
          _id: wrapper._id,
          itemId: itemIdStr,
          title: itemDoc.title || `Question ${index + 1}`,
          question: itemDoc.question,
          type: itemDoc.type,
          options: [], // short answers have no options
          marks: itemDoc.marks || 1,
          correctAnswer: itemDoc.correctAnswer, // Added correctAnswer field
          correctIndex: -1, // not applicable
          explanation: itemDoc.explanation,
          userAnswer: answer
            ? {
                textAnswer: answer.textAnswer ?? null,
                answeredAt: answer.answeredAt,
              }
            : null,
          isCorrect,
        };
      }

      // label / table / data: not auto-graded yet; same response shape with needsManualMarking
      if (itemDoc.type === "label" || itemDoc.type === "table" || itemDoc.type === "data") {
        return {
          _id: wrapper._id,
          itemId: itemIdStr,
          title: itemDoc.title || `Question ${index + 1}`,
          question: itemDoc.question,
          type: itemDoc.type,
          options: itemDoc.options || [],
          marks: itemDoc.marks || 1,
          correctAnswer: itemDoc.correctAnswer, // Added correctAnswer field
          correctIndex: -1,
          explanation: itemDoc.explanation,
          userAnswer: answer
            ? {
                selectedIndex: answer.selectedIndex,
                textAnswer: answer.textAnswer ?? null,
                payload: answer.payload,
                answeredAt: answer.answeredAt,
              }
            : null,
          isCorrect: null,
          marksAwarded: 0,
          needsManualMarking: true,
        };
      }

      // MCQ result logic (mcq / multiple-choice)
      let correctAnswerIndex = -1;

      if (itemDoc.correctAnswer !== undefined && itemDoc.correctAnswer !== null) {
        if (Array.isArray(itemDoc.options)) {
          correctAnswerIndex = itemDoc.options.findIndex((opt) => opt === itemDoc.correctAnswer);
        }
      }

      if (correctAnswerIndex === -1 && typeof itemDoc.correctIndex === "number") {
        correctAnswerIndex = itemDoc.correctIndex;
      }

      const isCorrect = correctAnswerIndex !== -1 && answer?.selectedIndex === correctAnswerIndex;
      const marksAwarded = isCorrect ? (itemDoc.marks || 1) : 0;

      return {
        _id: wrapper._id,
        itemId: itemIdStr,
        title: itemDoc.title || `Question ${index + 1}`,
        question: itemDoc.question,
        type: itemDoc.type,
        options: itemDoc.options || [],
        marks: itemDoc.marks || 1,
        correctAnswer: itemDoc.correctAnswer,
        correctIndex: correctAnswerIndex,
        explanation: itemDoc.explanation,
        userAnswer: answer
          ? {
              selectedIndex: answer.selectedIndex,
              answeredAt: answer.answeredAt,
            }
          : null,
        isCorrect,
        marksAwarded,
      };
    });

    // Prepare response
    const response = {
      success: true,
      attempt: {
        _id: attempt._id,
        paperId: attempt.paperId,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        durationSeconds: attempt.durationSeconds,
        timeUsedSeconds: attempt.timeUsedSeconds,
        autoSubmitted: attempt.autoSubmitted,
        score: attempt.score,
      },
      paper: {
        _id: attempt.paperId._id,
        title: attempt.paperId.title,
        subject: attempt.paperId.subject,
        examBoard: attempt.paperId.examBoard,
        level: attempt.paperId.level,
        tier: attempt.paperId.tier,
        kind: attempt.paperId.kind,
        timeSeconds: attempt.paperId.timeSeconds,
      },
      questionResults,
    };

    return res.json(response);
  } catch (err) {
    console.error("Error in GET /api/assessment-attempts/:id/results:", err);
    return res.status(500).json({
      success: false,
      msg: "Server error",
      error: err.message,
    });
  }
});

/* =========================================
   PUT /api/assessment-attempts/:id/complete - DEPRECATED
   Mark attempt as completed (legacy endpoint - removed)
   ========================================= */

router.put("/:id/complete", auth, async (req, res) => {
  return res.status(410).json({
    success: false,
    msg: "This endpoint is deprecated. Please use POST /api/assessment-attempts/:id/submit instead.",
  });
});

/* =========================================
   DELETE /api/assessment-attempts/:id
   Delete attempt (admin only, or student can delete own in_progress)
   ========================================= */

router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        msg: "Invalid attempt ID",
      });
    }

    const attempt = await AssessmentAttempt.findById(id);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        msg: "Attempt not found",
      });
    }

    const isAttemptOwner = String(attempt.studentId) === String(user.userId || user._id);

    // Students can only delete their own in_progress attempts
    if (isAttemptOwner && attempt.status === "in_progress") {
      await AssessmentAttempt.findByIdAndDelete(id);
      return res.json({
        success: true,
        msg: "Attempt deleted successfully",
      });
    }

    // Admins can delete any attempt
    if (isAdmin(user)) {
      await AssessmentAttempt.findByIdAndDelete(id);
      return res.json({
        success: true,
        msg: "Attempt deleted successfully",
      });
    }

    return res.status(403).json({
      success: false,
      msg: "You can only delete your own in-progress attempts",
    });
  } catch (err) {
    console.error("Error in DELETE /api/assessment-attempts/:id:", err);
    return res.status(500).json({
      success: false,
      msg: "Server error",
      error: err.message,
    });
  }
});

module.exports = router;