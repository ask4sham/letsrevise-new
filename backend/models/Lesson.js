// backend/models/Lesson.js
const mongoose = require("mongoose");

/**
 * =====================================================
 * Lesson Schema
 * - Keeps legacy lessons working (content markdown blob)
 * - Adds structured pages[] for the new student experience
 * - DOES NOT break uploads (uploadedImages stays)
 * - Adds admin moderation fields WITHOUT breaking anything
 * - ✅ Adds OPTIONAL visualModelId per page (for visual-first Biology MVP)
 * - ✅ Extends checkpoint schema (optional) for explain/markScheme later
 * - ✅ Adds template fields: isTemplate, createdFromTemplate, templateSource
 * - ✅ ADDED: Flashcards and Quiz schema for revision features
 * =====================================================
 */

const LessonPageBlockSchema = new mongoose.Schema(
  {
    // "text" | "keyIdea" | "examTip" | "commonMistake" | "stretch"
    type: {
      type: String,
      enum: ["text", "keyIdea", "examTip", "commonMistake", "stretch"],
      default: "text",
    },
    content: { type: String, default: "" }, // markdown-friendly
  },
  { _id: false }
);

// Kept for backward compatibility with older lessons that may still have hero saved.
// (UI removed; we simply ignore it.)
// NOTE: frontend currently supports src being string OR object shapes; backend keeps string for stored data.
const LessonPageHeroSchema = new mongoose.Schema(
  {
    // "none" | "image" | "video" | "animation"
    type: {
      type: String,
      enum: ["none", "image", "video", "animation"],
      default: "none",
    },
    src: { type: String, default: "" }, // url
    caption: { type: String, default: "" },
  },
  { _id: false }
);

const LessonPageCheckpointSchema = new mongoose.Schema(
  {
    // Existing (MCQ)
    question: { type: String, default: "" },
    options: { type: [String], default: [] },
    answer: { type: String, default: "" },

    /**
     * ✅ Optional extensions for next-gen checkpoints (non-breaking)
     * - type: allows "shortExplain" later without changing existing MCQ rendering
     * - markScheme: used for teacher-facing rubric / keyword marking / AI marking later
     *
     * Frontend can ignore these safely today.
     */
    type: {
      type: String,
      enum: ["mcq", "shortExplain"],
      default: "mcq",
    },
    markScheme: { type: [String], default: undefined },
  },
  { _id: false }
);

const LessonPageSchema = new mongoose.Schema(
  {
    // IMPORTANT: frontend uses pageId
    pageId: { type: String, required: true },

    title: { type: String, default: "" },

    // used for ordering in sidebar
    order: { type: Number, default: 0 },

    pageType: { type: String, default: "" },

    // legacy; kept so old saved data does not break
    hero: { type: LessonPageHeroSchema, default: undefined },

    blocks: { type: [LessonPageBlockSchema], default: [] },

    checkpoint: { type: LessonPageCheckpointSchema, default: undefined },

    /**
     * ✅ OPTIONAL: visual model reference (Photosynthesis MVP)
     * Non-breaking:
     * - existing pages without this field continue to render normally
     * - if present, frontend can render a diagram/animation panel for the page
     *
     * We store as ObjectId ref for future querying, but it's optional.
     */
    visualModelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VisualModel",
      default: undefined,
    },
  },
  { _id: false }
);

const LessonSchema = new mongoose.Schema(
  {
    // core
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },

    /**
     * ✅ Legacy lesson content (markdown blob)
     * DO NOT REMOVE or rename.
     * Your frontend legacy view reads lesson.content
     */
    content: { type: String, required: true, default: "" },

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    teacherName: { type: String, default: "" },

    subject: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },
    topic: { type: String, required: true, trim: true },

    // optional metadata
    tags: { type: [String], default: [] },
    estimatedDuration: { type: Number, default: 0 },
    shamCoinPrice: { type: Number, default: 0 },

    resources: { type: [String], default: [] },

    // exam board / tier
    board: { type: String, default: "" },
    tier: { type: String, default: undefined },

    /**
     * ✅ Uploads
     * Keep as-is so existing image uploads continue to work
     */
    uploadedImages: { type: [String], default: [] },

    /**
     * ✅ New structured pages (optional)
     * If empty => legacy lesson view
     * If has pages => new page-based lesson player
     */
    pages: { type: [LessonPageSchema], default: [] },

    // ✅ ADDED: Flashcards for revision
    flashcards: [
      {
        id: { type: String, required: true },
        front: { type: String, required: true },
        back: { type: String, required: true },
        tags: { type: [String], default: [] },
        difficulty: { type: Number, min: 1, max: 3, default: 1 }
      }
    ],

    // ✅ ADDED: Quiz for revision
    quiz: {
      timeSeconds: { type: Number, default: 600 },
      questions: [
        {
          id: { type: String, required: true },
          type: { type: String, enum: ["mcq", "short", "exam"], required: true },

          question: { type: String, required: true },

          // MCQ only
          options: { type: [String], default: undefined },

          // MCQ & short answer
          correctAnswer: { type: String, default: "" },

          // Exam only
          markScheme: { type: [String], default: undefined },

          explanation: { type: String, default: "" },
          tags: { type: [String], default: [] },
          difficulty: { type: Number, min: 1, max: 3, default: 1 },
          marks: { type: Number, default: 1 }
        }
      ]
    },

    // publishing / stats
    isPublished: { type: Boolean, default: false },
    views: { type: Number, default: 0 },

    /** When true, non-entitled users get preview (first page only). When false/undefined, lesson is hard-locked unless subscribed or purchased. */
    isFreePreview: { type: Boolean, default: false },

    /**
     * ✅ Admin moderation + dashboard compatibility
     * These fields are referenced by your admin routes/UI.
     * They do NOT break anything if unused elsewhere.
     */
    status: {
      type: String,
      enum: ["draft", "published", "archived", "flagged"],
      default: "draft",
    },
    adminNotes: { type: String, default: "" },

    /**
     * ✅ Purchases counter (admin dashboard expects it)
     * Your current purchase flow stores purchases in User + Purchase collection,
     * but admin UI references lesson.purchases; so keep a counter field.
     */
    purchases: { type: Number, default: 0 },

    // ratings (if you use these)
    averageRating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },

    /**
     * ✅ Template fields
     * - isTemplate: true = this lesson IS a template (admin-owned)
     * - createdFromTemplate: true = this lesson was cloned from a template
     * - templateSource: reference to the source template lesson (if known)
     */
    isTemplate: { type: Boolean, default: false, index: true },
    createdFromTemplate: { type: Boolean, default: false, index: true },
    templateSource: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Lesson", 
      default: null 
    },
  },
  { timestamps: true }
);

/**
 * ✅ Keep isPublished and status aligned automatically (WITHOUT silently unpublishing)
 *
 * Goal:
 * - Old lessons might have isPublished=true but status missing or default "draft"
 * - Editing them should NOT flip them to draft/unpublished
 *
 * Rules:
 * 1) If status missing/invalid -> infer from isPublished
 * 2) If isPublished === true -> force status "published"
 * 3) If status === "published" -> isPublished true
 * 4) Else -> isPublished false
 *
 * IMPORTANT:
 * - We do this WITHOUT callback-style `next()` to avoid "next is not a function"
 *   errors from mixed promise/callback hook execution paths.
 */
LessonSchema.pre("save", function () {
  const valid = ["draft", "published", "archived", "flagged"];

  // 1) If status is missing/invalid, infer from isPublished
  if (!this.status || !valid.includes(this.status)) {
    this.status = this.isPublished ? "published" : "draft";
  }

  // 2) If currently published, never let status drift away from "published"
  // (prevents "edit -> becomes draft -> disappears from student dashboard")
  if (this.isPublished === true && this.status !== "published") {
    this.status = "published";
  }

  // 3/4) Final alignment (single source of truth = status)
  this.isPublished = this.status === "published";
});

module.exports = mongoose.model("Lesson", LessonSchema);