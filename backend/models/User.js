// backend/models/User.js
const mongoose = require("mongoose");

/**
 * Derive the platform stage from a UK year group.
 * - 7,8,9 => KS3
 * - 10,11 => GCSE
 * - 12,13 => A-level
 */
function deriveStageKeyFromYearGroup(yearGroup) {
  const n = Number(yearGroup);
  if (!Number.isFinite(n)) return null;

  if (n >= 7 && n <= 9) return "ks3";
  if (n >= 10 && n <= 11) return "gcse";
  if (n >= 12 && n <= 13) return "a-level";
  return null;
}

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    userType: {
      type: String,
      required: true,
      enum: ["teacher", "student", "parent", "admin"],
    },

    /** Limited staff role: content_manager can access lessons/taxonomy/content, not users/finance/ops. */
    staffRole: {
      type: String,
      enum: ["content_manager"],
      default: null,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: false,
      default: "",
      trim: true,
    },

    // NEW: explicit school name for both teachers & students
    schoolName: {
      type: String,
      trim: true,
      default: null,
    },

    // Existing field – keep as-is in case other parts of the app use it
    institution: {
      type: String,
      trim: true,
    },

    verificationStatus: {
      type: String,
      default: "pending",
      enum: ["pending", "verified", "rejected"],
    },

    /** Email verification: token sent on signup, cleared when verified. */
    emailVerificationToken: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },
    /** Last time a verification email was sent (signup or resend) — server-side cooldown. */
    verificationEmailLastSentAt: { type: Date, default: null },

    /** Password reset: token sent on forgot-password, cleared after successful reset. */
    passwordResetToken: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },

    /** Email change (non-admin): pending new email, token, expiry. Cleared when confirmed. */
    pendingNewEmail: { type: String, default: null },
    emailChangeToken: { type: String, default: null },
    emailChangeExpires: { type: Date, default: null },

    /** Last successful authentication (login). Server-owned; optional for legacy users. */
    lastLoginAt: { type: Date, default: null },

    /**
     * Soft-delete (admin): user row stays so Lesson.teacherId and FK-style refs remain valid.
     * HARD deleteOne() on User is dangerous: lessons use teacherId; a new account with the same email
     * gets a new _id and orphaned lessons disappear from "My lessons". Prefer soft-delete + restore.
     */
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null, trim: true },

    earnings: {
      type: Number,
      default: 0,
    },
    balance: {
      type: Number,
      default: 0,
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
    },

    // ✅ Legacy subscription flag (string-based)
    subscription: {
      type: String,
      enum: ["free", "basic", "premium", "enterprise"],
      default: "free",
    },
    subscriptionEndDate: {
      type: Date,
    },

    /** Phase D1: exactly-once trial flag; set by grantTrialIfEligible only. */
    trialUsed: { type: Boolean, default: false },

    /**
     * Phase B subscription model (optional, non-breaking)
     * - Supports plan + status + explicit expiry
     * - Existing users may not have this field at all
     * - No business logic yet; routes still use the legacy string subscription
     */
    subscriptionV2: {
      plan: {
        type: String,
        enum: ["monthly", "annual", "dev", "trial"],
      },
      planId: { type: String, default: null },
      provider: { type: String, default: null },
      status: {
        type: String,
        enum: ["active", "expired", "trialing", "past_due", "canceled", "incomplete", "unpaid"],
      },
      expiresAt: {
        type: Date,
      },
      cancelAtPeriodEnd: { type: Boolean, default: false },
    },

    /**
     * Stripe billing state (B2+). Written exclusively by Stripe webhooks in B3+.
     * Never overwrites subscriptionV2 (admin grant / trial provenance).
     */
    stripeBilling: {
      customerId: { type: String, default: null },
      subscriptionId: { type: String, default: null },
      priceId: { type: String, default: null },
      planId: { type: String, default: null },
      status: { type: String, default: null },
      currentPeriodEnd: { type: Date, default: null },
      paidThrough: { type: Date, default: null },
      cancelAtPeriodEnd: { type: Boolean, default: false },
      lastInvoicePaidAt: { type: Date, default: null },
    },

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    referredBy: {
      type: String,
      trim: true,
    },

    /**
     * ✅ NEW (non-breaking): Student "Year group" + derived stage
     * If yearGroup is set (7..13), we auto-derive stageKey in pre-save.
     * You can also explicitly set stageKey if you want (e.g. for imports).
     */
    yearGroup: {
      type: Number,
      min: 1,
      max: 14,
      default: null,
    },

    // Single source for gating: 'ks3' | 'gcse' | 'a-level'
    stageKey: {
      type: String,
      enum: ["ks3", "gcse", "a-level"],
      default: null,
    },

    // ✅ Parent → linked children (students)
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    purchasedLessons: [
      {
        lessonId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Lesson",
        },
        purchasedAt: {
          type: Date,
          default: Date.now,
        },
        price: {
          type: Number,
        },
        completed: {
          type: Boolean,
          default: false,
        },
        completedAt: Date,
        progress: {
          type: Number,
          default: 0,
          min: 0,
          max: 100,
        },
        lastAccessed: Date,
        timeSpentMinutes: {
          type: Number,
          default: 0,
        },
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        review: String,
        reviewedAt: Date,
      },
    ],

    studentStats: {
      totalLessonsPurchased: {
        type: Number,
        default: 0,
      },
      totalLessonsCompleted: {
        type: Number,
        default: 0,
      },
      totalLearningTimeMinutes: {
        type: Number,
        default: 0,
      },
      averageProgress: {
        type: Number,
        default: 0,
      },
      streakDays: {
        type: Number,
        default: 0,
      },
      lastActiveDate: Date,
    },

    teacherStats: {
      totalLessonsCreated: {
        type: Number,
        default: 0,
      },
      totalStudents: {
        type: Number,
        default: 0,
      },
      averageRating: {
        type: Number,
        default: 0,
      },
      totalReviews: {
        type: Number,
        default: 0,
      },
    },

    createdLessons: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lesson",
      },
    ],

    transactions: [
      {
        type: {
          type: String,
          enum: ["purchase", "sale", "cashout", "refund", "deposit", "withdrawal", "transfer"],
        },
        amount: {
          type: Number,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        description: String,
        lessonId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Lesson",
        },
        status: {
          type: String,
          default: "completed",
          enum: ["pending", "completed", "failed", "cancelled"],
        },
        reference: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Mongoose 9 compatible middleware - no next parameter for non-async
userSchema.pre("save", function () {
  this.updatedAt = Date.now();

  // ✅ Auto-derive stageKey from yearGroup (student only)
  if (this.userType === "student") {
    // If yearGroup changed, or stageKey missing, derive it
    if (this.isModified("yearGroup") || !this.stageKey) {
      const derived = deriveStageKeyFromYearGroup(this.yearGroup);
      if (derived) this.stageKey = derived;
    }
  }

  // Auto-update student stats
  if (this.isModified("purchasedLessons") && this.userType === "student") {
    const purchasedLessons = this.purchasedLessons || [];
    this.studentStats.totalLessonsPurchased = purchasedLessons.length;
    this.studentStats.totalLessonsCompleted = purchasedLessons.filter((lesson) => lesson.completed)
      .length;
    this.studentStats.totalLearningTimeMinutes = purchasedLessons.reduce(
      (sum, lesson) => sum + (lesson.timeSpentMinutes || 0),
      0
    );

    if (purchasedLessons.length > 0) {
      const totalProgress = purchasedLessons.reduce((sum, lesson) => sum + (lesson.progress || 0), 0);
      this.studentStats.averageProgress = totalProgress / purchasedLessons.length;
    }
  }

});

module.exports = mongoose.model("User", userSchema);
