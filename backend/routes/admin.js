// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const User = require("../models/User");
const Lesson = require("../models/Lesson");
const auth = require("../middleware/auth");
const { isSubscriptionActive } = require("../utils/isSubscriptionActive");
const adminAiGenerationJobs = require("./adminAiGenerationJobs");

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
  // ✅ support either req.user.userType or req.user.type shapes
  // (some JWT payloads use `type`, some use `userType`)
  const userType = (req.user?.userType || req.user?.type || "").toString().toLowerCase();

  if (!req.user || userType !== "admin") {
    return res.status(403).json({ msg: "Admin access required" });
  }
  next();
};

// Helper: determine lesson status even if schema doesn't have `status`
function getLessonStatus(lesson) {
  if (lesson && typeof lesson.status === "string" && lesson.status.trim()) return lesson.status;
  return lesson?.isPublished ? "published" : "draft";
}

// Helper: build query for status filter safely (works even if `status` isn't in schema)
function applyStatusFilter(query, status) {
  if (!status) return;

  const s = String(status).toLowerCase().trim();

  if (s === "published") {
    query.$or = [{ status: "published" }, { isPublished: true }];
    return;
  }

  if (s === "draft") {
    query.$or = [{ status: "draft" }, { isPublished: false, status: { $exists: false } }];
    return;
  }

  if (["archived", "flagged"].includes(s)) {
    query.status = s;
  }
}

// Helper: whitelist lesson fields an admin is allowed to update safely
function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/* =========================================
   GET /api/admin/stats
   ========================================= */
router.get("/stats", auth, checkAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTeachers = await User.countDocuments({ userType: "teacher" });
    const totalStudents = await User.countDocuments({ userType: "student" });
    const totalLessons = await Lesson.countDocuments();

    const totalPurchasesAgg = await User.aggregate([
      { $unwind: "$purchasedLessons" },
      { $group: { _id: null, total: { $sum: 1 } } },
    ]);
    const totalPurchases = totalPurchasesAgg?.[0]?.total || 0;

    const revenueStats = await User.aggregate([
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": { $in: ["purchase", "subscription"] },
          "transactions.status": "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$transactions.amount" },
          todayRevenue: {
            $sum: {
              $cond: [
                { $gte: ["$transactions.date", new Date(new Date().setHours(0, 0, 0, 0))] },
                "$transactions.amount",
                0,
              ],
            },
          },
          monthlyRevenue: {
            $sum: {
              $cond: [
                { $gte: ["$transactions.date", new Date(new Date().setDate(new Date().getDate() - 30))] },
                "$transactions.amount",
                0,
              ],
            },
          },
        },
      },
    ]);

    const lessonStats = await Lesson.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$views" },
          averageRating: { $avg: "$averageRating" },
        },
      },
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const subscriptionStats = await User.aggregate([
      {
        $group: {
          _id: "$subscription",
          count: { $sum: 1 },
          totalShamCoins: { $sum: "$shamCoins" },
        },
      },
    ]);

    const subsMap = subscriptionStats.reduce((acc, stat) => {
      acc[stat._id] = { count: stat.count, totalShamCoins: stat.totalShamCoins };
      return acc;
    }, {});

    const totalShamCoins = subscriptionStats.reduce(
      (sum, stat) => sum + (stat.totalShamCoins || 0),
      0
    );

    const activeUsers = await User.countDocuments({
      $or: [
        { "studentStats.lastActiveDate": { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) } },
        { updatedAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) } },
      ],
    });

    res.json({
      success: true,
      stats: {
        users: { total: totalUsers, teachers: totalTeachers, students: totalStudents, growth: userGrowth },
        lessons: {
          total: totalLessons,
          totalViews: lessonStats?.[0]?.totalViews || 0,
          averageRating: lessonStats?.[0]?.averageRating || 0,
          totalPurchases,
          platformEarnings: 0,
        },
        revenue: {
          total: revenueStats?.[0]?.totalRevenue || 0,
          today: revenueStats?.[0]?.todayRevenue || 0,
          monthly: revenueStats?.[0]?.monthlyRevenue || 0,
        },
        subscriptions: subsMap,
        platform: { totalShamCoins, activeUsers },
      },
    });
  } catch (err) {
    console.error("Get admin stats error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Mount placeholder admin AI generation jobs router (no routes yet)
router.use("/ai-generation-jobs", adminAiGenerationJobs);

/* =========================================
   GET /api/admin/user-types   ✅ new (helps UI dropdown include parent)
   ========================================= */
router.get("/user-types", auth, checkAdmin, async (req, res) => {
  return res.json({
    success: true,
    userTypes: ["student", "teacher", "parent", "admin"],
  });
});

/* =========================================
   GET /api/admin/users
   ========================================= */
router.get("/users", auth, checkAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, userType, search, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const query = {};

    // ✅ includes parent (backend already supported; keeping explicit)
    if (userType && ["teacher", "student", "admin", "parent"].includes(String(userType))) {
      query.userType = String(userType);
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const users = await User.find(query)
      .select("-password")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalUsers = await User.countDocuments(query);

    res.json({
      success: true,
      users: users.map((u) => ({
        id: u._id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        userType: u.userType,
        verificationStatus: u.verificationStatus,
        shamCoins: u.shamCoins,
        subscription: u.subscription,
        createdAt: u.createdAt,
        lastActive: u.userType === "student" ? u.studentStats?.lastActiveDate : u.updatedAt,
        stats: u.userType === "teacher" ? u.teacherStats : u.studentStats,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/users/:userId
   ========================================= */
router.get("/users/:userId", auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Invalid user id" });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });

    return res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        verificationStatus: user.verificationStatus,
        verificationNotes: user.verificationNotes,
        shamCoins: user.shamCoins,
        subscription: user.subscription,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error("Get user detail error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   DELETE /api/admin/users/:userId
   ========================================= */
router.delete("/users/:userId", auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Invalid user id" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Optional safety: prevent deleting yourself
    const requesterId = req.user?._id || req.user?.id;
    if (String(user._id) === String(requesterId)) {
      return res.status(400).json({ msg: "You cannot delete your own admin account" });
    }

    const summary = { id: String(user._id), email: user.email, userType: user.userType };

    await user.deleteOne();

    console.log("🧹 [Admin] Deleted user:", summary, "by admin:", req.user.email);

    return res.json({ success: true, msg: "User deleted", deleted: summary });
  } catch (err) {
    console.error("Admin delete user error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/lessons
   ========================================= */
router.get("/lessons", auth, checkAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, subject, search, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const query = {
      isTemplate: { $ne: true }, // ✅ EXCLUDE master templates from lessons list
    };

    applyStatusFilter(query, status);
    if (subject) query.subject = subject;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const lessons = await Lesson.find(query)
      .populate("teacherId", "firstName lastName email")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalLessons = await Lesson.countDocuments(query);

    res.json({
      success: true,
      lessons: lessons.map((lesson) => {
        const statusResolved = getLessonStatus(lesson);

        const purchases = lesson.purchases || 0;
        const price = lesson.shamCoinPrice || 0;

        return {
          id: lesson._id,
          title: lesson.title,
          subject: lesson.subject,
          level: lesson.level,
          status: statusResolved,
          shamCoinPrice: price,
          views: lesson.views || 0,
          purchases,
          averageRating: lesson.averageRating || 0,
          createdAt: lesson.createdAt,
          teacher: lesson.teacherId
            ? {
                id: lesson.teacherId._id,
                name: `${lesson.teacherId.firstName} ${lesson.teacherId.lastName}`.trim(),
                email: lesson.teacherId.email,
              }
            : null,
          revenue: {
            total: purchases * price,
            platform: purchases * price * 0.3,
            teacher: purchases * price * 0.7,
          },
        };
      }),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalLessons,
        pages: Math.ceil(totalLessons / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Get lessons error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/templates
   (admin-only list of MASTER templates)
   ========================================= */
router.get("/templates", auth, checkAdmin, async (req, res) => {
  try {
    const templates = await Lesson.find({ isTemplate: true })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({ success: true, templates });
  } catch (err) {
    console.error("Get admin templates error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/template-clones
   (admin-only list of template clones for monitoring)
   ========================================= */
router.get("/template-clones", auth, checkAdmin, async (req, res) => {
  try {
    const clones = await Lesson.find({
      createdFromTemplate: true,
      isTemplate: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({ success: true, clones });
  } catch (err) {
    console.error("Get admin template clones error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/lessons/:lessonId
   (returns FULL lesson incl. pages/blocks)
   ========================================= */
router.get("/lessons/:lessonId", auth, checkAdmin, async (req, res) => {
  try {
    const { lessonId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonId).populate("teacherId", "firstName lastName email");
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    return res.json({
      success: true,
      lesson: {
        ...lesson.toObject(),
        status: getLessonStatus(lesson),
      },
    });
  } catch (err) {
    console.error("Admin get lesson detail error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   PUT /api/admin/lessons/:lessonId   ✅ new
   (admin can edit lesson using same payload shape as teacher editor)
   - does NOT break teacher routes
   - safe whitelist so random fields don't get written
   ========================================= */
router.put("/lessons/:lessonId", auth, checkAdmin, async (req, res) => {
  try {
    const { lessonId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    // Allow same core fields teacher editor uses
    const allowed = [
      "title",
      "description",
      "content",
      "subject",
      "level",
      "topic",
      "tags",
      "estimatedDuration",
      "shamCoinPrice",
      "resources",
      "board",
      "tier",
      "uploadedImages",
      "pages",
      "teacherName",
      "isPublished",
      "status",
      "adminNotes",
      "isTemplate", // Allow admin to see/update this field
      "createdFromTemplate", // Allow admin to see/update this field
      "templateSource", // Allow admin to see/update this field
    ];

    const updates = pick(req.body || {}, allowed);

    // Basic validation to avoid corrupting pages accidentally
    if (Object.prototype.hasOwnProperty.call(updates, "pages")) {
      if (!Array.isArray(updates.pages)) {
        return res.status(400).json({ msg: "pages must be an array" });
      }
    }

    // If status provided, keep isPublished aligned (same logic as status endpoint)
    if (typeof updates.status === "string" && updates.status) {
      const s = String(updates.status).toLowerCase();
      if (!["published", "draft", "archived", "flagged"].includes(s)) {
        return res.status(400).json({ msg: "Invalid status" });
      }
      updates.status = s;
      if (s === "published") updates.isPublished = true;
      if (["draft", "archived", "flagged"].includes(s)) updates.isPublished = false;
    }

    // Prevent writing weird non-objects
    for (const [k, v] of Object.entries(updates)) {
      if (k === "resources" || k === "uploadedImages" || k === "tags" || k === "pages") continue;
      // allow primitives / null
      if (typeof v === "function") {
        return res.status(400).json({ msg: `Invalid field: ${k}` });
      }
    }

    Object.assign(lesson, updates);
    await lesson.save();

    return res.json({
      success: true,
      msg: "Lesson updated",
      lesson: {
        ...lesson.toObject(),
        status: getLessonStatus(lesson),
      },
    });
  } catch (err) {
    console.error("Admin update lesson error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   PUT /api/admin/lessons/:lessonId/status
   (keeps isPublished aligned)
   ========================================= */
router.put("/lessons/:lessonId/status", auth, checkAdmin, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { status, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    if (!status || !["published", "archived", "flagged", "draft"].includes(String(status))) {
      return res.status(400).json({ msg: "Valid status is required" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    const oldStatus = getLessonStatus(lesson);

    lesson.status = status;

    if (status === "published") lesson.isPublished = true;
    if (status === "draft" || status === "archived" || status === "flagged") lesson.isPublished = false;

    if (status === "flagged" && reason) lesson.adminNotes = reason;

    await lesson.save();

    res.json({
      success: true,
      msg: `Lesson status updated from ${oldStatus} to ${status}`,
      lesson: {
        id: lesson._id,
        title: lesson.title,
        status: getLessonStatus(lesson),
        adminNotes: lesson.adminNotes,
        isPublished: lesson.isPublished,
      },
    });
  } catch (err) {
    console.error("Update lesson status error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   DELETE /api/admin/lessons/:lessonId
   ========================================= */
router.delete("/lessons/:lessonId", auth, checkAdmin, async (req, res) => {
  try {
    const { lessonId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    // ✅ Enhanced safety for deleting master templates
    if (lesson.isTemplate === true) {
      // Check for confirmation in query parameter (since DELETE requests often don't have body)
      const confirmToken = String(req.query?.confirm || "");
      if (confirmToken !== "DELETE") {
        return res.status(400).json({
          msg: 'Deleting a master template requires confirmation. Add ?confirm=DELETE to the URL',
          templateId: lesson._id,
          title: lesson.title,
          hint: 'Master templates are critical admin resources. Use DELETE /api/admin/lessons/' + lessonId + '?confirm=DELETE'
        });
      }
    }

    const summary = {
      id: String(lesson._id),
      title: lesson.title,
      teacherId: lesson.teacherId ? String(lesson.teacherId) : "",
      status: getLessonStatus(lesson),
      isPublished: lesson.isPublished,
      isTemplate: lesson.isTemplate,
      createdFromTemplate: lesson.createdFromTemplate,
    };

    await lesson.deleteOne();

    console.log("🧹 [Admin] Deleted lesson:", summary, "by admin:", req.user.email);

    return res.json({ success: true, msg: "Lesson deleted", deleted: summary });
  } catch (err) {
    console.error("Admin delete lesson error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/transactions
   ========================================= */
router.get("/transactions", auth, checkAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, type, status, dateFrom, dateTo, sortBy = "date", sortOrder = "desc" } = req.query;

    const pipeline = [];
    pipeline.push({ $unwind: "$transactions" });

    const matchStage = {};
    if (type) matchStage["transactions.type"] = type;
    if (status) matchStage["transactions.status"] = status;

    if (dateFrom || dateTo) {
      matchStage["transactions.date"] = {};
      if (dateFrom) matchStage["transactions.date"].$gte = new Date(dateFrom);
      if (dateTo) matchStage["transactions.date"].$lte = new Date(dateTo);
    }

    if (Object.keys(matchStage).length > 0) pipeline.push({ $match: matchStage });

    pipeline.push({
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userInfo",
      },
    });

    pipeline.push({ $unwind: "$userInfo" });

    pipeline.push({
      $project: {
        _id: "$transactions._id",
        userId: "$_id",
        userEmail: "$userInfo.email",
        userName: { $concat: ["$userInfo.firstName", " ", "$userInfo.lastName"] },
        userType: "$userInfo.userType",
        type: "$transactions.type",
        amount: "$transactions.amount",
        date: "$transactions.date",
        description: "$transactions.description",
        status: "$transactions.status",
        reference: "$transactions.reference",
        lessonId: "$transactions.lessonId",
      },
    });

    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };
    pipeline.push({ $sort: sort });

    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: (parseInt(page) - 1) * parseInt(limit) }, { $limit: parseInt(limit) }],
      },
    });

    const result = await User.aggregate(pipeline);
    const transactions = result?.[0]?.data || [];
    const total = result?.[0]?.metadata?.[0]?.total || 0;

    res.json({
      success: true,
      transactions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    console.error("Get transactions error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   PUT /api/admin/users/:userId/verify
   ========================================= */
router.put("/users/:userId/verify", auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    if (!status || !["verified", "rejected"].includes(status)) {
      return res.status(400).json({ msg: 'Status must be "verified" or "rejected"' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (user.userType !== "teacher") {
      return res.status(400).json({ msg: "Only teachers can be verified" });
    }

    const oldStatus = user.verificationStatus;
    user.verificationStatus = status;

    if (status === "rejected" && reason) user.verificationNotes = reason;

    await user.save();

    res.json({
      success: true,
      msg: `Teacher ${status === "verified" ? "verified" : "rejected"} successfully`,
      user: {
        id: user._id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        verificationStatus: user.verificationStatus,
        verificationNotes: user.verificationNotes,
      },
      changes: { from: oldStatus, to: status },
    });
  } catch (err) {
    console.error("Verify user error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   PUT /api/admin/users/:userId/role
   ========================================= */
router.put("/users/:userId/role", auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // ✅ includes parent
    if (!role || !["teacher", "student", "admin", "parent"].includes(role)) {
      return res.status(400).json({ msg: "Valid role is required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const oldRole = user.userType;
    user.userType = role;

    if (role === "admin") user.verificationStatus = "verified";

    await user.save();

    res.json({
      success: true,
      msg: `User role updated from ${oldRole} to ${role}`,
      user: {
        id: user._id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        userType: user.userType,
        verificationStatus: user.verificationStatus,
      },
    });
  } catch (err) {
    console.error("Update role error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   POST /api/admin/shamcoins
   ========================================= */
router.post("/shamcoins", auth, checkAdmin, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || amount === undefined || amount === null) {
      return res.status(400).json({ msg: "User ID and amount are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Invalid user id" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ msg: "Amount must be a non-zero number" });
    }

    const oldBalance = user.shamCoins || 0;
    user.shamCoins = oldBalance + delta;

    if (user.shamCoins < 0) {
      return res.status(400).json({ msg: "Cannot set negative sham coins balance" });
    }

    const transactionType = delta > 0 ? "admin_deposit" : "admin_withdrawal";
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: transactionType,
      amount: delta,
      description: reason || `Admin adjustment: ${delta > 0 ? "+" : ""}${delta} ShamCoins`,
      status: "completed",
      reference: `ADMIN-${Date.now()}`,
      date: new Date(),
    });

    await user.save();

    res.json({
      success: true,
      msg: `Sham coins ${delta > 0 ? "added to" : "removed from"} user account`,
      adjustment: {
        userId: user._id,
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        amount: delta,
        oldBalance,
        newBalance: user.shamCoins,
        reason,
        transactionId: user.transactions[user.transactions.length - 1]._id,
      },
    });
  } catch (err) {
    console.error("Adjust sham coins error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   POST /api/admin/subscription/grant
   Dev-only helper to grant a time-limited subscription for testing.
   ========================================= */
router.post("/subscription/grant", auth, checkAdmin, async (req, res) => {
  try {
    const { userId, days } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Valid userId is required" });
    }

    const daysNum = Number(days);
    if (!Number.isFinite(daysNum) || daysNum <= 0) {
      return res.status(400).json({ msg: "days must be a positive number" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + daysNum * 24 * 60 * 60 * 1000);

    // Phase B: use subscriptionV2 when present; keep legacy fields untouched.
    user.subscriptionV2 = user.subscriptionV2 || {};
    user.subscriptionV2.plan = "dev";
    user.subscriptionV2.status = "active";
    user.subscriptionV2.expiresAt = expiresAt;

    await user.save();

    const active = isSubscriptionActive(user);

    return res.json({
      success: true,
      userId: String(user._id),
      expiresAt,
      isActive: active,
    });
  } catch (err) {
    console.error("Admin subscription grant error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   POST /api/admin/subscription/expire
   Dev-only helper to force a subscription to expire for testing.
   ========================================= */
router.post("/subscription/expire", auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Valid userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    user.subscriptionV2 = user.subscriptionV2 || {};
    user.subscriptionV2.status = "expired";
    user.subscriptionV2.expiresAt = yesterday;

    await user.save();

    const active = isSubscriptionActive(user);

    return res.json({
      success: true,
      userId: String(user._id),
      expiresAt: user.subscriptionV2.expiresAt,
      isActive: active,
    });
  } catch (err) {
    console.error("Admin subscription expire error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;