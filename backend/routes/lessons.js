// backend/routes/lessons.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Lesson = require("../models/Lesson");
const User = require("../models/User");
const Purchase = require("../models/Purchase");
const VisualModel = require("../models/VisualModel");
const auth = require("../middleware/auth");
const { canAccessContent } = require("../utils/canAccessContent");
const { isSubscriptionActive } = require("../utils/isSubscriptionActive");
const { grantTrialIfEligible } = require("../utils/grantTrialIfEligible");

// ✅ ADDED: Import for revision validation
const { validateAndNormalizeRevision } = require("../services/validateRevision");

// ✅ ADDED: Import for curated visuals
const { findCuratedVisual } = require("../utils/curatedVisuals");

console.log("✅ lessons router file loaded");

/* =========================================
   ✅ ADDED: PING ROUTE FOR TESTING
   ========================================= */

router.get("/_ping", (req, res) => {
  res.json({ ok: true, router: "lessons", ts: Date.now() });
});

/* =========================================
   GCSE TIER HELPERS
   ========================================= */

function normalizeTier(tier) {
  if (tier === undefined || tier === null) return undefined;

  const t = String(tier).trim().toLowerCase();

  if (t === "" || t === "none" || t === "all") return undefined;
  if (t.includes("foundation")) return "foundation";
  if (t.includes("higher")) return "higher";
  if (t === "foundation" || t === "higher") return t;

  return t;
}

function sanitizeTierByLevel(level, tier) {
  if (!level) return undefined;
  if (String(level).toUpperCase() !== "GCSE") return undefined;
  return normalizeTier(tier);
}

/* =========================================
   ✅ ADDED: ROLE ENFORCEMENT HELPER (Centralized)
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
   PAGES SANITISER (shared) - FIXED HERO PERSISTENCE
   ========================================= */

function makePageIdFallback(idx) {
  return `p_${Date.now()}_${idx}_${Math.random().toString(16).slice(2)}`;
}

// ✅ UPDATED: Separate sanitization from merging logic
function sanitisePageInput(p, isUpdate = false) {
  const pageId =
    p && typeof p.pageId === "string" && p.pageId.trim()
      ? p.pageId.trim()
      : makePageIdFallback(0);

  const order = Number.isFinite(Number(p?.order)) ? Number(p.order) : 1;

  // ✅ FIXED: During update, don't default hero to {type:"none"} if missing
  let hero;
  if (p?.hero && typeof p.hero === "object") {
    const heroType = String(p.hero.type || "");
    if (["none", "image", "video", "animation"].includes(heroType)) {
      hero = {
        type: heroType,
        src: typeof p.hero.src === "string" ? p.hero.src : "",
        caption: typeof p.hero.caption === "string" ? p.hero.caption : "",
      };
    } else if (!isUpdate && heroType === "") {
      // Only default to "none" on creation, not update
      hero = { type: "none", src: "", caption: "" };
    }
  } else if (!isUpdate) {
    // Only default on creation
    hero = { type: "none", src: "", caption: "" };
  }

  const blocks = Array.isArray(p?.blocks)
    ? p.blocks.map((b) => ({
        type: ["text", "keyIdea", "examTip", "commonMistake", "stretch"].includes(String(b?.type))
          ? String(b.type)
          : "text",
        content: typeof b?.content === "string" ? b.content : "",
      }))
    : [];

  const checkpoint =
    p?.checkpoint && typeof p.checkpoint === "object"
      ? {
          question: typeof p.checkpoint.question === "string" ? p.checkpoint.question : "",
          options: Array.isArray(p.checkpoint.options)
            ? p.checkpoint.options.map((x) => String(x)).slice(0, 4)
            : [],
          answer: typeof p.checkpoint.answer === "string" ? p.checkpoint.answer : "",
        }
      : undefined;

  // ✅ NEW (non-breaking): allow saving visualModelId if provided
  const visualModelId =
    p?.visualModelId && mongoose.Types.ObjectId.isValid(String(p.visualModelId))
      ? String(p.visualModelId)
      : undefined;

  return {
    pageId,
    title: typeof p?.title === "string" ? p.title : "",
    order,
    pageType: typeof p?.pageType === "string" ? p.pageType : "",
    hero,
    blocks,
    checkpoint,
    ...(visualModelId ? { visualModelId } : {}),
  };
}

function sanitisePagesInput(pages, isUpdate = false) {
  if (!Array.isArray(pages)) return [];
  return pages.map((p) => sanitisePageInput(p, isUpdate));
}

// ✅ NEW: Merge pages while preserving existing hero if not explicitly set in update
function mergePagesOnUpdate(lessonId, existingPages = [], incomingPages = []) {
  if (!Array.isArray(incomingPages)) {
    console.warn(`⚠️ [Lesson ${lessonId}] incomingPages is not an array, defaulting to empty`);
    incomingPages = [];
  }

  const existingPagesMap = new Map();
  existingPages.forEach(page => {
    if (page.pageId) {
      existingPagesMap.set(page.pageId, page);
    }
  });

  const result = [];

  incomingPages.forEach((incomingPage, idx) => {
    const pageId = incomingPage.pageId || makePageIdFallback(idx);
    const existingPage = existingPagesMap.get(pageId);
    
    // If we have an existing page, check if we should preserve its hero
    if (existingPage && existingPage.hero && existingPage.hero.type !== "none") {
      const incomingHero = incomingPage.hero;
      
      // ✅ ADDED: Suspicious overwrite detection with logging
      if (!incomingHero || (incomingHero && incomingHero.type === "none")) {
        // ✅ FIX: REGRESSION GUARD - Log warning about suspicious hero overwrite
        console.warn(`⚠️ [Lesson ${lessonId}] Suspicious hero overwrite on page ${pageId}:`, {
          existingHeroType: existingPage.hero.type,
          incomingHero: incomingHero ? "type: 'none'" : "missing",
          action: "PRESERVING existing hero"
        });
        
        // Incoming doesn't specify hero or sets it to "none", preserve existing hero
        const sanitizedPage = sanitisePageInput(incomingPage, true);
        sanitizedPage.hero = existingPage.hero;
        result.push(sanitizedPage);
      } else if (incomingHero && incomingHero.type !== "none") {
        // Incoming has a valid hero, use it
        result.push(sanitisePageInput(incomingPage, true));
      } else {
        // Edge case: use incoming as-is
        result.push(sanitisePageInput(incomingPage, true));
      }
    } else {
      // No existing page or no existing hero, use incoming as-is
      result.push(sanitisePageInput(incomingPage, true));
    }
  });

  return result.sort((a, b) => (a.order || 0) - (b.order || 0));
}

/* =========================================
   UPLOADED IMAGES NORMALISER
   ========================================= */

function normalizeUploadedImages(uploadedImages) {
  if (!Array.isArray(uploadedImages)) return [];

  return uploadedImages
    .map((x) => {
      if (typeof x === "string") return x;
      if (x && typeof x === "object" && typeof x.url === "string") return x.url;
      return "";
    })
    .map((s) => String(s).trim())
    .filter(Boolean);
}

/* =========================================
   ✅ STAGE/KEYSTAGE HELPERS (Option A)
   ========================================= */

// Support your typo migration: stageKey -> Keystage
function normalizeKeyStage(v) {
  const s = (v || "").toString().trim().toLowerCase();
  if (!s) return "";
  if (s.includes("ks3")) return "ks3";
  if (s.includes("gcse") || s.includes("ks4")) return "gcse";
  if (s.includes("a-level") || s.includes("alevel") || s.includes("a level")) return "a-level";
  return s;
}

function deriveKeyStageFromYearGroup(yearGroup) {
  const n = Number(yearGroup);
  if (!Number.isFinite(n)) return "";
  if (n >= 7 && n <= 9) return "ks3";
  if (n >= 10 && n <= 11) return "gcse";
  if (n >= 12 && n <= 13) return "a-level";
  return "";
}

function keyStageToLessonLevelLabel(ks) {
  const k = normalizeKeyStage(ks);
  if (k === "ks3") return "KS3";
  if (k === "gcse") return "GCSE";
  if (k === "a-level") return "A-Level";
  return "";
}

// best-effort auth id getter
function getAuthUserId(req) {
  return req.user?.userId || req.user?.id || req.user?._id || null;
}

/* =========================================
   ✅ NORMALISATION HELPERS (level/board)
   ========================================= */

// Case/format safe regex for Lesson.level
function levelToRegex(levelStr) {
  if (!levelStr) return null;
  const s = String(levelStr).trim().toLowerCase();

  if (!s) return null;
  if (s.includes("ks3") || s === "ks 3") return /ks\s*3/i;
  if (s.includes("gcse")) return /gcse/i;

  // A-Level variants: "A-Level", "A level", "Alevel", "A-level"
  if (s.includes("a") && s.includes("level")) return /a[\s-]?level/i;

  // fallback: case-insensitive exact-ish
  return new RegExp(`^${escapeRegex(String(levelStr).trim())}$`, "i");
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Treat null/empty/"not set" as "Not set"
function isNotSetBoard(boardStr) {
  const b = (boardStr || "").toString().trim().toLowerCase();
  return !b || b === "not set" || b === "none";
}

/* =========================================
   ✅ VISUAL ENRICHMENT HELPERS (non-breaking)
   ========================================= */

function normalizeLevelForVisual(levelRaw) {
  const s = (levelRaw || "").toString().trim().toLowerCase();
  if (!s) return "";
  if (s.includes("ks3") || s.includes("key stage 3")) return "KS3";
  if (s.includes("gcse")) return "GCSE";
  if (s.includes("a") && s.includes("level")) return "A-Level";
  return levelRaw;
}

function topicToConceptKey(topic) {
  const t = (topic || "").toString().trim().toLowerCase();
  if (!t) return "";
  if (t.includes("photosynthesis")) return "photosynthesis";
  return "";
}

async function attachVisualsToPagesIfPossible(lessonObj) {
  try {
    if (!lessonObj) return lessonObj;

    const pages = Array.isArray(lessonObj.pages) ? lessonObj.pages : [];
    if (pages.length === 0) return lessonObj;

    const conceptKey = topicToConceptKey(lessonObj.topic);
    if (!conceptKey) return lessonObj;

    const level = normalizeLevelForVisual(lessonObj.level);
    if (!level) return lessonObj;

    const visualModel = await VisualModel.findOne({
      conceptKey,
      isPublished: true,
    }).lean();

    if (!visualModel) return lessonObj;

    const variant = (visualModel.variants || []).find((v) => String(v.level) === String(level));
    if (!variant) return lessonObj;

    // Attach the same variant to any page that has no explicit visualModelId
    // This keeps behaviour stable AND gives you instant MVP visuals for Photosynthesis.
    const nextPages = pages.map((p) => {
      if (p && p.visualModelId) return p;
      return {
        ...p,
        visual: {
          conceptKey: visualModel.conceptKey,
          level,
          type: variant.type,
          src: variant.src,
          steps: Array.isArray(variant.steps) ? variant.steps : [],
          labels: Array.isArray(variant.labels) ? variant.labels : [],
          hiddenLabels: Array.isArray(variant.hiddenLabels) ? variant.hiddenLabels : [],
          narration: variant.narration || "",
        },
      };
    });

    return { ...lessonObj, pages: nextPages };
  } catch (e) {
    // Never break lesson view if visuals fail
    console.warn("⚠️ Visual enrichment skipped:", e?.message || e);
    return lessonObj;
  }
}

/* =========================================
   CREATE LESSON HANDLER (teachers only)
   ========================================= */

async function createLessonHandler(req, res) {
  try {
    console.log("✅ [Lessons] POST /api/lessons hit");

    if (!req.user) {
      console.error("❌ [Lessons] No req.user on request");
      return res.status(401).json({ msg: "No user on request" });
    }

    console.log("✅ [Lessons] Authenticated user:", {
      id: req.user._id || req.user.id,
      email: req.user.email,
      userType: req.user.userType,
    });

    if (req.user.userType !== "teacher") {
      return res.status(403).json({ msg: "Only teachers can create lessons" });
    }

    const {
      title,
      description,
      content,
      subject,
      level,
      topic,
      tags,
      estimatedDuration,
      shamCoinPrice,
      resources,
      board,
      tier,
      externalResources,
      uploadedImages,
      pages,
      quiz,
    } = req.body || {};

    const missing = {};
    if (!title) missing.title = true;
    if (!description) missing.description = true;
    if (!content) missing.content = true;
    if (!subject) missing.subject = true;
    if (!level) missing.level = true;
    if (!topic) missing.topic = true;
    if (estimatedDuration === undefined || estimatedDuration === null) {
      missing.estimatedDuration = true;
    }

    if (Object.keys(missing).length > 0) {
      console.log("❌ [Lessons] Validation failed, missing:", missing);
      return res.status(400).json({
        msg: "Please fill in all required fields",
        missing,
      });
    }

    const tagsArray =
      typeof tags === "string"
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : Array.isArray(tags)
        ? tags
        : [];

    const resourcesArray = Array.isArray(resources)
      ? resources
      : typeof externalResources === "string"
      ? externalResources
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean)
      : [];

    const lessonData = {
      title,
      description,
      content,
      teacherId: req.user._id,
      teacherName:
        `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() ||
        req.user.email,
      subject,
      level,
      topic,
      tags: tagsArray,
      estimatedDuration,
      shamCoinPrice: shamCoinPrice || 0,
      resources: resourcesArray,

      // Teachers create drafts by default.
      status: "draft",
      isPublished: false,
    };

    if (board) lessonData.board = board;

    const normalisedTier = sanitizeTierByLevel(level, tier);
    if (normalisedTier) {
      lessonData.tier = normalisedTier;
    }

    const imgs = normalizeUploadedImages(uploadedImages);
    if (imgs.length > 0) {
      lessonData.uploadedImages = imgs;
    }

    // ✅ FIXED: Use sanitisePagesInput for creation (no merge needed)
    const safePages = sanitisePagesInput(pages, false);
    if (safePages.length > 0) {
      lessonData.pages = safePages.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    // ✅ ADDED: Normalize quiz.questions to array server-side
    if (quiz && typeof quiz === "object") {
      const quizData = { ...quiz };
      if (!Array.isArray(quizData.questions)) {
        console.warn("⚠️ [Lessons] quiz.questions is not an array, defaulting to empty");
        quizData.questions = [];
      }
      lessonData.quiz = quizData;
    }

    // ✅ ADDED: Auto-attach curated hero visual for AQA GCSE Biology with debug logging
    console.log("🧩 [CuratedVisual] lookup input:", {
      subject: lessonData.subject,
      examBoard: lessonData.board || "AQA",
      level: lessonData.level,
      topic: lessonData.topic,
    });

    try {
      const result = findCuratedVisual({
        subject: lessonData.subject,
        examBoard: lessonData.board || "AQA",
        level: lessonData.level,
        topic: lessonData.topic,
      });

      console.log("🧩 [CuratedVisual] result:", result?.debug);

      const hero = result?.hero;

      if (hero) {
        if (!Array.isArray(lessonData.pages)) lessonData.pages = [];
        if (!lessonData.pages[0])
          lessonData.pages[0] = {
            pageId: `p_${Date.now()}_0`,
            order: 1,
            title: "Overview",
            blocks: [],
          };

        lessonData.pages[0].hero = hero;
        console.log("✅ [CuratedVisual] hero attached:", hero);
      } else {
        console.log("⚠️ [CuratedVisual] no hero match");
      }
    } catch (e) {
      console.warn("⚠️ Curated hero attach skipped:", e?.message || e);
    }

    console.log("🧠 [Lessons] Saving lesson with payload:", {
      ...lessonData,
      pagesCount: Array.isArray(lessonData.pages) ? lessonData.pages.length : 0,
      uploadedImagesCount: Array.isArray(lessonData.uploadedImages)
        ? lessonData.uploadedImages.length
        : 0,
      hasHero: lessonData.pages?.[0]?.hero ? true : false,
    });

    const lesson = new Lesson(lessonData);
    await lesson.save();
    console.log("✅ [Lessons] Lesson saved:", lesson._id);

    let updatedShamCoins = 0;
    try {
      const dbUser = await User.findById(req.user._id);
      if (dbUser) {
        dbUser.shamCoins = (dbUser.shamCoins || 0) + 50;
        await dbUser.save();
        updatedShamCoins = dbUser.shamCoins;
        console.log(
          "✅ [Lessons] Awarded 50 ShamCoins to teacher:",
          dbUser.email,
          "New balance:",
          updatedShamCoins
        );
      } else {
        console.warn(
          "⚠️ [Lessons] Could not find teacher in DB to award ShamCoins:",
          req.user._id
        );
      }
    } catch (coinErr) {
      console.error("⚠️ [Lessons] Failed to award ShamCoins:", coinErr);
    }

    return res.json({
      success: true,
      msg: "Lesson created successfully! You earned 50 ShamCoins!",
      lesson,
      updatedShamCoins,
    });
  } catch (err) {
    console.error("❌ [Lessons] Lesson creation error details:");
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);

    return res.status(500).json({
      success: false,
      error: "Server error",
      message: err.message,
    });
  }
}

/* =========================================
   CLONE GOLD-STANDARD LESSON HANDLER
   ========================================= */

async function cloneGoldLesson(req, res) {
  try {
    console.log("✅ [Lessons] POST /api/lessons/clone-gold hit");

    if (!req.user) {
      console.error("❌ [Lessons] No req.user on request");
      return res.status(401).json({ msg: "No user on request" });
    }

    if (req.user.userType !== "teacher") {
      return res.status(403).json({ msg: "Only teachers can clone lessons" });
    }

    // Find a gold-standard lesson to clone
    // For now, let's find the most recent well-structured lesson as a template
    // In the future, you can mark specific lessons as "gold-standard" in your database
    const goldLesson = await Lesson.findOne({
      isPublished: true,
      status: "published",
      $or: [
        { title: { $regex: /photosynthesis/i } },
        { topic: { $regex: /photosynthesis/i } }
      ]
    }).sort({ createdAt: -1 });

    if (!goldLesson) {
      // If no gold lesson found, create a basic template
      const templateLesson = new Lesson({
        title: "GCSE Biology: Photosynthesis (Template Copy)",
        description: "A comprehensive lesson on photosynthesis including light-dependent and light-independent reactions.",
        content: "This is a gold-standard template lesson. Customize it for your needs.",
        teacherId: req.user._id,
        teacherName: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || req.user.email,
        subject: "Biology",
        level: "GCSE",
        topic: "Photosynthesis",
        tags: ["biology", "photosynthesis", "plants", "respiration"],
        estimatedDuration: 60,
        shamCoinPrice: 50,
        resources: [],
        board: "AQA",
        tier: "higher",
        status: "draft",
        isPublished: false,
        // ✅ Add flag to identify template-created lessons
        createdFromTemplate: true,
        pages: [
          {
            pageId: "overview",
            title: "Overview",
            order: 1,
            pageType: "overview",
            blocks: [
              {
                type: "text",
                content: "Photosynthesis is the process by which plants convert light energy into chemical energy."
              },
              {
                type: "keyIdea",
                content: "Key equation: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂"
              }
            ]
          },
          {
            pageId: "core_content",
            title: "Core Content",
            order: 2,
            pageType: "content",
            blocks: [
              {
                type: "text",
                content: "Photosynthesis occurs in the chloroplasts of plant cells, specifically in the thylakoid membranes."
              },
              {
                type: "examTip",
                content: "Remember that chlorophyll is the pigment that absorbs light energy."
              }
            ]
          },
          {
            pageId: "check_understanding",
            title: "Check Understanding",
            order: 3,
            pageType: "checkpoint",
            blocks: [
              {
                type: "text",
                content: "Test your knowledge with these questions:"
              }
            ],
            checkpoint: {
              question: "What are the products of photosynthesis?",
              options: ["Glucose and oxygen", "Carbon dioxide and water", "ATP and NADPH", "Chlorophyll and water"],
              answer: "Glucose and oxygen"
            }
          },
          {
            pageId: "exam_tips",
            title: "Exam Tips",
            order: 4,
            pageType: "exam",
            blocks: [
              {
                type: "examTip",
                content: "Always write the photosynthesis equation with state symbols for full marks."
              },
              {
                type: "commonMistake",
                content: "Don't confuse photosynthesis with respiration - they are opposite processes!"
              }
            ]
          },
          {
            pageId: "stretch",
            title: "Stretch & Challenge",
            order: 5,
            pageType: "stretch",
            blocks: [
              {
                type: "text",
                content: "Core knowledge: Photosynthesis converts light energy to chemical energy."
              },
              {
                type: "stretch",
                content: "Deeper knowledge: The Calvin cycle uses ATP and NADPH from the light-dependent reactions to fix carbon dioxide into organic molecules."
              }
            ]
          }
        ]
      });

      const clonedLesson = await templateLesson.save();
      
      console.log("✅ [Lessons] Created template lesson for cloning:", clonedLesson._id);
      
      return res.json({
        success: true,
        msg: "Gold-standard template lesson created successfully!",
        lessonId: clonedLesson._id,
        lesson: clonedLesson
      });
    }

    // Clone the found gold lesson
    const clonedData = {
      ...goldLesson.toObject(),
      _id: undefined,
      id: undefined,
      // ✅ UPDATED: Clear title to avoid accidental publishing of "Copy of ..."
      title: `${goldLesson.title} (Template Copy)`,
      teacherId: req.user._id,
      teacherName: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || req.user.email,
      status: "draft",
      isPublished: false,
      // ✅ Add flag to identify template-created lessons
      createdFromTemplate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0,
      averageRating: 0,
      purchaseCount: 0,
      totalEarnings: 0
    };

    // Remove any purchase-related fields
    delete clonedData.purchaseCount;
    delete clonedData.totalEarnings;

    const clonedLesson = new Lesson(clonedData);
    await clonedLesson.save();

    console.log("✅ [Lessons] Gold lesson cloned:", {
      originalId: goldLesson._id,
      originalTitle: goldLesson.title,
      clonedId: clonedLesson._id,
      clonedTitle: clonedLesson.title,
      teacher: req.user.email
    });

    return res.json({
      success: true,
      msg: "Gold-standard lesson cloned successfully!",
      lessonId: clonedLesson._id,
      lesson: clonedLesson
    });
  } catch (err) {
    console.error("❌ [Lessons] Clone gold lesson error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error",
      message: err.message
    });
  }
}

/* =========================================
   ✅ ADDED: ADMIN-ONLY DELETE ENFORCEMENT HELPER
   ========================================= */

function enforceAdminOnlyDeletion(req, existingLesson, incomingData) {
  if (isAdmin(req.user)) {
    return true; // Admins can do anything
  }

  // ✅ Check if teacher is trying to delete flashcards
  const existingFlashIds = new Set();
  (existingLesson.flashcards || []).forEach(card => {
    if (card.id) existingFlashIds.add(String(card.id));
  });

  const incomingFlashIds = new Set();
  const incomingFlashcards = incomingData.flashcards || [];
  incomingFlashcards.forEach(card => {
    if (card.id) incomingFlashIds.add(String(card.id));
  });

  // If existing has IDs that incoming doesn't have → deletion attempt
  for (const id of existingFlashIds) {
    if (!incomingFlashIds.has(id)) {
      console.warn(`⚠️ Teacher ${req.user._id} attempted to delete flashcard ${id}`);
      return false;
    }
  }

  // ✅ Check if teacher is trying to delete quiz questions
  const existingQuizIds = new Set();
  ((existingLesson.quiz || {}).questions || []).forEach(q => {
    if (q.id) existingQuizIds.add(String(q.id));
  });

  const incomingQuizQuestions = 
    incomingData.quiz?.questions || 
    incomingData.quizQuestions || 
    incomingData.quiz || 
    [];
  
  const incomingQuizIds = new Set();
  incomingQuizQuestions.forEach(q => {
    if (q.id) incomingQuizIds.add(String(q.id));
  });

  // If existing has IDs that incoming doesn't have → deletion attempt
  for (const id of existingQuizIds) {
    if (!incomingQuizIds.has(id)) {
      console.warn(`⚠️ Teacher ${req.user._id} attempted to delete quiz question ${id}`);
      return false;
    }
  }

  // ✅ Check empty array cases
  if (incomingFlashcards.length === 0 && existingFlashIds.size > 0) {
    console.warn(`⚠️ Teacher ${req.user._id} attempted to delete all flashcards with empty array`);
    return false;
  }

  if (incomingQuizQuestions.length === 0 && existingQuizIds.size > 0) {
    console.warn(`⚠️ Teacher ${req.user._id} attempted to delete all quiz questions with empty array`);
    return false;
  }

  return true;
}

/* =========================================
   ✅ ADDED: REVISION CONTENT ROUTE
   Attach or replace revision content (flashcards + quiz)
   ========================================= */

// ✅ AUTH MIDDLEWARE RESTORED
router.post("/:id/revision", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // ✅ AUTHORIZATION CHECK RESTORED
    const requesterId = req.user?._id;
    const requesterType = req.user?.userType;
    const isOwner = String(lesson.teacherId) === String(requesterId);
    const isAdminUser = isAdmin(req.user);

    if (!isOwner && !isAdminUser) {
      return res.status(403).json({ msg: "Not authorized to update this lesson" });
    }

    // ✅ ENFORCE ADMIN-ONLY DELETION
    if (!isAdminUser && !enforceAdminOnlyDeletion(req, lesson, req.body)) {
      return res.status(403).json({ 
        msg: "Teachers cannot delete flashcards or quiz questions. Only admins can delete." 
      });
    }

    // Validate + normalise revision payload
    const { flashcards, quiz } = validateAndNormalizeRevision(req.body);

    // Attach (additive, non-destructive to lesson pages)
    if (flashcards !== undefined) {
      lesson.flashcards = flashcards;
    }

    if (quiz !== undefined) {
      lesson.quiz = quiz;
    }

    // ✅ ADDED: runValidators and return updated document
    const updatedLesson = await lesson.save();
    
    res.json({
      success: true,
      lessonId: updatedLesson._id,
      flashcardsCount: updatedLesson.flashcards?.length ?? 0,
      quizQuestionsCount: updatedLesson.quiz?.questions?.length ?? 0,
      lesson: updatedLesson
    });
  } catch (err) {
    console.error("REVISION_ATTACH_ERROR", err);
    res.status(400).json({
      error: err.message || "Failed to attach revision content"
    });
  }
});

/* =========================================
   ✅ ADDED: AI-GENERATED REVISION CONTENT
   ========================================= */

router.post("/:id/generate-revision", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // Check authorization using centralized helper
    const requesterId = req.user?._id;
    const isOwner = String(lesson.teacherId) === String(requesterId);
    const isAdminUser = isAdmin(req.user);

    if (!isOwner && !isAdminUser) {
      return res.status(403).json({ msg: "Not authorized to generate revision for this lesson" });
    }

    // Check if lesson has content to generate from
    if (!lesson.pages || lesson.pages.length === 0) {
      return res.status(400).json({ 
        error: "Lesson has no content pages to generate revision from" 
      });
    }

    // Check OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: "OpenAI API key not configured. Please contact administrator." 
      });
    }

    console.log(`🤖 Generating AI revision content for lesson: ${lesson.title}`);

    // Dynamically import the generateRevision service
    // Use require() instead of import for compatibility
    const { generateRevisionForLesson } = require("../services/generateRevision");
    
    // Generate revision content using AI
    const revisionContent = await generateRevisionForLesson({ lesson });
    
    // Validate the generated content matches our schema
    const { validateAndNormalizeRevision } = require("../services/validateRevision");
    const { flashcards, quiz } = validateAndNormalizeRevision(revisionContent);

    // Attach to lesson (additive - preserves any existing content)
    if (flashcards !== undefined && flashcards.length > 0) {
      lesson.flashcards = flashcards;
    }

    if (quiz !== undefined && quiz.questions && quiz.questions.length > 0) {
      lesson.quiz = quiz;
    }

    // ✅ ADDED: runValidators and return updated document
    const updatedLesson = await lesson.save();

    console.log(`✅ AI revision generated: ${flashcards?.length || 0} flashcards, ${quiz?.questions?.length || 0} quiz questions`);

    res.json({
      success: true,
      lessonId: updatedLesson._id,
      flashcardsCount: flashcards?.length || 0,
      quizQuestionsCount: quiz?.questions?.length || 0,
      generatedContent: {
        flashcards: flashcards || [],
        quiz: quiz || { questions: [] }
      },
      lesson: updatedLesson
    });
  } catch (err) {
    console.error("AI_REVISION_GENERATION_ERROR", err);
    
    // Provide user-friendly error messages
    let errorMessage = "Failed to generate revision content";
    if (err.message.includes("API key") || err.message.includes("OpenAI")) {
      errorMessage = "OpenAI API error. Please check API key configuration.";
    } else if (err.message.includes("network") || err.message.includes("timeout")) {
      errorMessage = "Network error. Please try again.";
    } else if (err.message.includes("validation") || err.message.includes("JSON")) {
      errorMessage = "AI response format error. Please try again.";
    }
    
    res.status(400).json({
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  }
});

/* =========================================
   ROUTES
   ========================================= */

// Create a lesson
router.post("/", auth, createLessonHandler);

// Clone gold-standard lesson
router.post("/clone-gold", auth, cloneGoldLesson);

// Get all lessons by a teacher WITH purchase stats
router.get("/teacher", auth, async (req, res) => {
  try {
    if (req.user.userType !== "teacher") {
      return res.status(403).json({ msg: "Only teachers can view their lessons" });
    }

    const lessons = await Lesson.find({ teacherId: req.user._id }).sort({
      createdAt: -1,
    });

    const lessonsWithStats = await Promise.all(
      lessons.map(async (lesson) => {
        const lessonObj = lesson.toObject();

        const purchaseCount = await Purchase.countDocuments({
          lessonId: lesson._id,
        });
        lessonObj.purchaseCount = purchaseCount;

        const purchases = await Purchase.find({ lessonId: lesson._id });
        const totalEarnings = purchases.reduce(
          (sum, purchase) => sum + (purchase.teacherEarnings || 0),
          0
        );
        lessonObj.totalEarnings = totalEarnings;

        return lessonObj;
      })
    );

    return res.json(lessonsWithStats);
  } catch (err) {
    console.error("Error fetching teacher lessons:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Teacher dashboard stats
router.get("/teacher/stats", auth, async (req, res) => {
  try {
    if (req.user.userType !== "teacher") {
      return res.status(403).json({ msg: "Only teachers can view stats" });
    }

    const teacherId = req.user._id;
    const lessons = await Lesson.find({ teacherId });

    const stats = {
      totalLessons: lessons.length,
      publishedLessons: lessons.filter((l) => l.isPublished === true).length,
      draftLessons: lessons.filter((l) => l.isPublished === false).length,
      totalEarnings: 0,
      totalPurchases: 0,
      averageRating: 0,
      monthlyEarnings: [],
    };

    const purchases = await Purchase.find({ teacherId });

    stats.totalPurchases = purchases.length;
    stats.totalEarnings = purchases.reduce(
      (sum, purchase) => sum + (purchase.teacherEarnings || 0),
      0
    );

    const publishedLessons = lessons.filter((l) => l.isPublished === true);
    if (publishedLessons.length > 0) {
      const totalRating = publishedLessons.reduce(
        (sum, lesson) => sum + (lesson.averageRating || 0),
        0
      );
      stats.averageRating = totalRating / publishedLessons.length;
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentPurchases = purchases.filter((p) => p.timestamp >= sixMonthsAgo);

    const monthlyData = {};
    recentPurchases.forEach((purchase) => {
      const month = purchase.timestamp.toISOString().slice(0, 7);
      monthlyData[month] = (monthlyData[month] || 0) + (purchase.teacherEarnings || 0);
    });

    stats.monthlyEarnings = Object.entries(monthlyData)
      .map(([month, earnings]) => ({
        month: new Date(month + "-01").toLocaleString("default", { month: "short" }),
        earnings,
      }))
      .sort((a, b) => {
        const dateA = new Date(a.month + " 1");
        const dateB = new Date(b.month + " 1");
        return dateA - dateB;
      });

    return res.json(stats);
  } catch (err) {
    console.error("Error fetching teacher stats:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   SAVE STRUCTURED PAGES (teacher/admin) - FIXED HERO PERSISTENCE
   ========================================= */

router.put("/:id/pages", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    const requesterId = req.user?._id;
    const requesterType = req.user?.userType;

    const isOwner = String(lesson.teacherId) === String(requesterId);
    const isAdminUser = isAdmin(req.user);

    if (!isOwner && !isAdminUser) {
      return res.status(403).json({ msg: "Not authorised" });
    }

    const pages = Array.isArray(req.body.pages) ? req.body.pages : null;
    if (!pages) return res.status(400).json({ msg: "pages[] required" });

    // ✅ FIXED: Use mergePagesOnUpdate instead of sanitisePagesInput
    const mergedPages = mergePagesOnUpdate(lessonId, lesson.pages || [], pages);

    lesson.pages = mergedPages;
    
    // ✅ ADDED: runValidators and return updated document
    const updatedLesson = await lesson.save({ new: true, runValidators: true });

    return res.json({
      success: true,
      msg: "Pages saved",
      pagesCount: updatedLesson.pages.length,
      firstPageId: updatedLesson.pages[0]?.pageId || null,
      lesson: updatedLesson
    });
  } catch (err) {
    console.error("Save pages error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/* =========================================
   PUBLISH / UNPUBLISH (teacher/admin)
   ========================================= */

async function publishToggleHandler(req, res, mode) {
  try {
    const lessonId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    const requesterId = req.user?._id;
    const isOwner = String(lesson.teacherId) === String(requesterId);
    const isAdminUser = isAdmin(req.user);

    if (!isOwner && !isAdminUser) {
      return res.status(401).json({ msg: "User not authorized" });
    }

    if (["archived", "flagged"].includes(String(lesson.status || ""))) {
      return res.status(403).json({ msg: "Lesson is moderated and cannot be published" });
    }

    if (mode === "publish") {
      lesson.isPublished = true;
    } else {
      if (typeof req.body?.isPublished === "boolean") {
        lesson.isPublished = req.body.isPublished;
      } else {
        lesson.isPublished = !Boolean(lesson.isPublished);
      }
    }

    if (lesson.isPublished) {
      lesson.status = "published";
    } else {
      lesson.status = "draft";
    }

    // ✅ ADDED: runValidators and return updated document
    const updatedLesson = await lesson.save({ new: true, runValidators: true });

    return res.json({
      success: true,
      msg: lesson.isPublished
        ? "Lesson published successfully"
        : "Lesson unpublished successfully",
      lesson: updatedLesson,
    });
  } catch (err) {
    console.error("Publish toggle error:", err);
    return res.status(500).send("Server error");
  }
}

router.patch("/:id/publish", auth, async (req, res) =>
  publishToggleHandler(req, res, "toggle")
);

router.put("/:id/publish", auth, async (req, res) =>
  publishToggleHandler(req, res, "publish")
);

/* =========================================
   Get lesson by ID (private)
   ✅ Now enriches pages with `page.visual` if Photosynthesis and no explicit visualModelId
   ========================================= */

router.get("/:id", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    let lesson = await Lesson.findById(lessonId).lean();

    if (!lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    const requesterId = req.user?._id;
    const requesterType = req.user?.userType;

    const isOwner = String(lesson.teacherId) === String(requesterId);
    const isAdminUser = isAdmin(req.user);

    const status = lesson.status || (lesson.isPublished ? "published" : "draft");
    const isPublished = String(status) === "published";

    if (!isAdminUser && !isOwner && !isPublished) {
      return res.status(403).json({ msg: "Lesson not published" });
    }

    Lesson.updateOne({ _id: lessonId }, { $inc: { views: 1 } }).catch(() => {});

    // ✅ Non-breaking: attach visuals to pages if available (Photosynthesis MVP)
    lesson = await attachVisualsToPagesIfPossible(lesson);

    const fullPages = Array.isArray(lesson.pages) ? lesson.pages : [];
    const isFreePreview = Boolean(lesson.isFreePreview);

    // ✅ Server-side entitlement: all lesson content checks must live here.
    // isFreePreview comes only from the lesson document; pages do not imply preview.
    let access = { allowed: true };
    if (!isAdminUser && !isOwner) {
      access = canAccessContent({ user: req.user, lesson: { ...lesson, isFreePreview } });
    }

    if (access.allowed === false) {
      return res.status(403).json({ message: "Subscription required" });
    }

    // Preview access: expose metadata + first page only, with no quizzes/flashcards.
    if (access.allowed === "preview") {
      const firstPageOnly = fullPages.length > 0 ? [fullPages[0]] : [];
      return res.json({
        ...lesson,
        status,
        isPublished,
        isFreePreview: true,
        pages: firstPageOnly,
        flashcards: [],
        quiz: undefined,
        content: typeof lesson.content === "string" ? lesson.content : "",
      });
    }

    // Full access (owner/admin or fully entitled user).
    return res.json({
      ...lesson,
      status,
      isPublished,
      pages: fullPages,
      content: typeof lesson.content === "string" ? lesson.content : "",
    });
  } catch (err) {
    console.error("Get lesson error:", err);
    return res.status(500).send("Server error");
  }
});

// Update lesson (teacher only)
router.put("/:id", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;
    
    // ✅ UPDATED: Use findByIdAndUpdate with runValidators and return updated doc
    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    const isOwner = String(lesson.teacherId) === String(req.user._id);
    const isAdminUser = isAdmin(req.user);

    if (!isOwner && !isAdminUser) {
      return res.status(401).json({ msg: "User not authorized" });
    }

    if (["archived", "flagged"].includes(String(lesson.status || ""))) {
      return res.status(403).json({ msg: "Lesson is moderated and cannot be edited" });
    }

    const updates = req.body || {};

    // ✅ FIXED: Handle pages update with hero preservation
    if (updates.pages && Array.isArray(updates.pages)) {
      // Use the new mergePagesOnUpdate function
      lesson.pages = mergePagesOnUpdate(lessonId, lesson.pages || [], updates.pages);
      delete updates.pages; // Remove from general updates to avoid overwriting
    }

    // ✅ ADDED: Normalize quiz.questions to array server-side
    if (updates.quiz && typeof updates.quiz === "object") {
      const quizData = { ...updates.quiz };
      if (!Array.isArray(quizData.questions)) {
        console.warn(`⚠️ [Lesson ${lessonId}] quiz.questions is not an array, defaulting to empty`);
        quizData.questions = [];
      }
      lesson.quiz = quizData;
      delete updates.quiz;
    }

    // ✅ ADDED: Normalize flashcards to array server-side
    if (updates.flashcards !== undefined) {
      if (!Array.isArray(updates.flashcards)) {
        console.warn(`⚠️ [Lesson ${lessonId}] flashcards is not an array, defaulting to empty`);
        lesson.flashcards = [];
      } else {
        lesson.flashcards = updates.flashcards;
      }
      delete updates.flashcards;
    }

    // Apply other updates
    Object.keys(updates).forEach((key) => {
      if (key === "isPublished") return;
      if (key === "status") return;
      lesson[key] = updates[key];
    });

    const newLevel = typeof updates.level === "string" ? updates.level : lesson.level;
    const requestedTier = Object.prototype.hasOwnProperty.call(updates, "tier")
      ? updates.tier
      : lesson.tier;

    lesson.tier = sanitizeTierByLevel(newLevel, requestedTier);

    // ✅ ADDED: runValidators and return updated document
    const updatedLesson = await lesson.save({ new: true, runValidators: true });
    
    return res.json({ 
      msg: "Lesson updated successfully", 
      lesson: updatedLesson 
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// Delete lesson (teacher only)
router.delete("/:id", auth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    const isOwner = String(lesson.teacherId) === String(req.user._id);
    const isAdminUser = isAdmin(req.user);

    if (!isOwner && !isAdminUser) {
      return res.status(401).json({ msg: "User not authorized" });
    }

    if (["archived", "flagged"].includes(String(lesson.status || ""))) {
      return res.status(403).json({ msg: "Lesson is moderated and cannot be deleted" });
    }

    await lesson.deleteOne();
    return res.json({ msg: "Lesson removed" });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// Purchase lesson (students only)
router.post("/:id/purchase", auth, async (req, res) => {
  try {
    console.log("Purchase attempt for lesson:", req.params.id);
    console.log("User attempting purchase:", req.user.email);

    if (req.user.userType !== "student") {
      return res.status(403).json({ msg: "Only students can purchase lessons" });
    }

    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    if (["archived", "flagged"].includes(String(lesson.status || ""))) {
      return res.status(403).json({ msg: "Lesson is not available" });
    }

    if (!lesson.isPublished) {
      return res.status(400).json({ msg: "Lesson is not published" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(500).json({
        success: false,
        error: "User not found in database",
      });
    }

    const alreadyPurchased = user.purchasedLessons?.some(
      (purchase) => purchase.lessonId.toString() === lesson._id.toString()
    );

    if (alreadyPurchased) {
      return res.status(400).json({
        msg: "You have already purchased this lesson",
        purchasedAt: user.purchasedLessons.find(
          (p) => p.lessonId.toString() === lesson._id.toString()
        ).purchasedAt,
      });
    }

    const studentShamCoins = user.shamCoins || 0;
    if (studentShamCoins < lesson.shamCoinPrice) {
      return res.status(400).json({
        msg: "Insufficient ShamCoins",
        required: lesson.shamCoinPrice,
        available: studentShamCoins,
      });
    }

    user.shamCoins -= lesson.shamCoinPrice;

    const purchaseRecord = {
      lessonId: lesson._id,
      price: lesson.shamCoinPrice,
      purchasedAt: new Date(),
    };

    user.purchasedLessons = user.purchasedLessons || [];
    user.purchasedLessons.push(purchaseRecord);

    const teacherEarnings = Math.floor(lesson.shamCoinPrice * 0.7);

    const teacher = await User.findById(lesson.teacherId);
    if (teacher) {
      teacher.shamCoins = (teacher.shamCoins || 0) + teacherEarnings;
      teacher.earnings = (teacher.earnings || 0) + teacherEarnings;

      teacher.transactions = teacher.transactions || [];
      teacher.transactions.push({
        type: "sale",
        amount: teacherEarnings,
        date: new Date(),
        description: `Lesson sale: ${lesson.title}`,
        lessonId: lesson._id,
        status: "completed",
      });

      await teacher.save();

      const { createNotification } = require("./notifications");
      await createNotification(
        teacher._id,
        "purchase_success",
        "Lesson Sold!",
        `A student purchased your lesson "${lesson.title}" for ${lesson.shamCoinPrice} ShamCoins`,
        {
          lessonId: lesson._id,
          price: lesson.shamCoinPrice,
          earnings: teacherEarnings,
        },
        `/lesson/${lesson._id}`
      );
    }

    const purchase = new Purchase({
      lessonId: lesson._id,
      studentId: user._id,
      teacherId: lesson.teacherId,
      price: lesson.shamCoinPrice,
      teacherEarnings: teacherEarnings,
      timestamp: new Date(),
    });

    await purchase.save();
    await user.save();

    return res.json({
      success: true,
      msg: "Lesson purchased successfully!",
      lesson: {
        id: lesson._id,
        title: lesson.title,
        price: lesson.shamCoinPrice,
      },
      user: {
        _id: user._id,
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        shamCoins: user.shamCoins,
        purchasedLessons: user.purchasedLessons,
      },
      remainingShamCoins: user.shamCoins,
      teacherEarned: teacherEarnings,
      purchaseRecord: purchaseRecord,
    });
  } catch (err) {
    console.error("Purchase error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error",
      details: err.message,
    });
  }
});

/*
 * POST /api/lessons/:id/unlock — Unlock full lesson with 1 ShamCoin (students only).
 *
 * Manual test steps:
 * 1. Log in as a student with shamCoins >= 1.
 * 2. Open a lesson that shows "Free preview" (preview mode).
 * 3. Click "Unlock full lesson (1 ShamCoin)".
 * 4. Expect: lesson refetches and shows full content; card on dashboard shows "Unlocked".
 * 5. With 0 ShamCoins, expect 400 "Not enough ShamCoins" and UI message + Subscribe link.
 * 6. With active subscription or already purchased, expect 200 { alreadyHasAccess: true } and no deduction.
 *
 * Trial: granted on first unlock, once per user (grantTrialIfEligible); does not block unlock on failure.
 */
router.post("/:id/unlock", auth, async (req, res) => {
  try {
    if (req.user.userType !== "student") {
      return res.status(403).json({ msg: "Only students can unlock lessons" });
    }

    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(500).json({ error: "User not found" });
    }

    if (isSubscriptionActive(user)) {
      return res.status(200).json({ success: true, alreadyHasAccess: true });
    }

    const alreadyPurchased = Array.isArray(user.purchasedLessons) && user.purchasedLessons.some(
      (pl) => String(pl?.lessonId ?? pl) === String(lesson._id)
    );
    if (alreadyPurchased) {
      return res.status(200).json({ success: true, alreadyHasAccess: true });
    }

    const coins = user.shamCoins != null ? user.shamCoins : 0;
    if (coins < 1) {
      return res.status(400).json({ message: "Not enough ShamCoins" });
    }

    user.shamCoins = coins - 1;
    user.purchasedLessons = user.purchasedLessons || [];
    user.purchasedLessons.push({
      lessonId: lesson._id,
      price: 1,
      purchasedAt: new Date(),
    });
    await user.save();

    let trialGranted = false;
    let trialExpiresAt;
    try {
      const trial = await grantTrialIfEligible({ userId: user._id, reason: "first_unlock" });
      if (trial.granted) {
        trialGranted = true;
        trialExpiresAt = trial.expiresAt;
      }
    } catch (e) {
      console.warn("Unlock: trial grant failed", e?.message || e);
    }

    return res.status(200).json({
      success: true,
      shamCoins: user.shamCoins,
      purchasedLessons: user.purchasedLessons,
      trialGranted,
      ...(trialExpiresAt && { trialExpiresAt }),
    });
  } catch (err) {
    console.error("Unlock error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

/* =========================================
   ✅ Option A: Get all published lessons (students)
   - Enforces student's level on the server
   - Supports query filters: subject, topic, board, tier, q
   ========================================= */

router.get("/", auth, async (req, res) => {
  try {
    const { subject, level, topic, teacher, tier, board, q, search } = req.query;

    const requesterType = (req.user?.userType || "").toString().toLowerCase();

    const query = {
      isPublished: true,
      status: { $nin: ["archived", "flagged"] },
    };

    // ✅ HARD RULE: students are locked to their own level
    if (requesterType === "student") {
      const userId = getAuthUserId(req);
      if (userId) {
        const u = await User.findById(userId)
          .select("Keystage stageKey yearGroup userType")
          .lean();

        const ks =
          normalizeKeyStage(u?.Keystage) ||
          normalizeKeyStage(u?.stageKey) ||
          deriveKeyStageFromYearGroup(u?.yearGroup);

        const forcedLevel = keyStageToLessonLevelLabel(ks);

        // If we can determine it, enforce it (normalization-safe)
        if (forcedLevel) {
          const re = levelToRegex(forcedLevel);
          if (re) query.level = re;
        }
      }
    } else {
      // teacher/admin: allow explicit level filtering (normalization-safe)
      if (level) {
        const re = levelToRegex(level);
        if (re) query.level = re;
      }
    }

    if (subject) query.subject = subject;

    if (board !== undefined) {
      // ✅ "Not set" should match missing/empty/"Not set"
      if (isNotSetBoard(board)) {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { board: { $exists: false } },
            { board: null },
            { board: "" },
            { board: { $regex: /^not set$/i } },
            { board: { $regex: /^none$/i } },
          ],
        });
      } else {
        // supports exact board match (case-insensitive exact)
        query.board = { $regex: `^${escapeRegex(String(board).trim())}$`, $options: "i" };
      }
    }

    if (topic) {
      query.topic = { $regex: String(topic), $options: "i" };
    }

    if (teacher) {
      query.teacherName = { $regex: String(teacher), $options: "i" };
    }

    // tier only applies when query.level is GCSE (works for regex too)
    // We only apply tier if caller explicitly sent tier AND the requested/effective level is GCSE.
    const levelIsGCSE =
      requesterType === "student"
        ? normalizeKeyStage(
            (await User.findById(getAuthUserId(req))
              .select("Keystage stageKey yearGroup")
              .lean()
              .then((u) => u?.Keystage || u?.stageKey || deriveKeyStageFromYearGroup(u?.yearGroup))
              .catch(() => "")) || ""
          ) === "gcse"
        : String(level || "").toLowerCase().includes("gcse");

    if (tier && levelIsGCSE) {
      const normalisedTier = normalizeTier(tier);
      if (normalisedTier) query.tier = normalisedTier;
    }

    // free-text search (title/subject/topic/board/level)
    const text = (q || search || "").toString().trim();
    if (text) {
      const rx = { $regex: text, $options: "i" };
      query.$or = [
        { title: rx },
        { subject: rx },
        { topic: rx },
        { board: rx },
        { level: rx },
      ];
    }

    let lessons = await Lesson.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    // Attach hasAccess and isFreePreview per lesson (entitlement from backend only).
    // isFreePreview comes only from the lesson document; pages do not imply preview.
    const fullUser = await User.findById(getAuthUserId(req))
      .select("userType subscriptionV2 subscription purchasedLessons")
      .lean();
    lessons = lessons.map((l) => {
      const isFreePreview = Boolean(l.isFreePreview);
      const access = fullUser ? canAccessContent({ user: fullUser, lesson: { _id: l._id, isFreePreview } }) : { allowed: false };
      return {
        ...l,
        hasAccess: access.allowed === true,
        isFreePreview,
      };
    });

    return res.json(lessons);
  } catch (err) {
    console.error("GET /api/lessons error:", err.message);
    return res.status(500).send("Server error");
  }
});

module.exports = router;
module.exports.createLessonHandler = createLessonHandler;