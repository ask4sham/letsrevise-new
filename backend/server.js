// /backend/server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// ✅ Load .env first
dotenv.config();

const path = require("path");
const fs = require("fs");
const connectDB = require("./config/database");

// --- MODELS & MIDDLEWARE NEEDED FOR DIRECT LESSON CREATION ---
const Lesson = require("./models/Lesson");
const User = require("./models/User");
const auth = require("./middleware/auth");
// --------------------------------------------------------------

const authRoutes = require("./routes/auth");
const lessonRoutes = require("./routes/lessons");
const earningsRoutes = require("./routes/earnings");
const reviewRoutes = require("./routes/reviews");
const userRoutes = require("./routes/users");
const notificationsRoutes = require("./routes/notifications");
const progressRoutes = require("./routes/progress");
const subscriptionRoutes = require("./routes/subscriptions");
const payoutRoutes = require("./routes/payouts");
const adminRoutes = require("./routes/admin");
const aiRoutes = require("./routes/ai");
const contentTreeRoutes = require("./routes/content-tree");
const uploadsRoutes = require("./routes/uploads");
const quizzesRoutes = require("./routes/quizzes");

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

/* ============================================================
   CORS CONFIG
============================================================ */

// Allowed frontends (local + Netlify)
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:4173",
  "https://profound-gumdrop-4c8d83.netlify.app",
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser tools (no origin) and allowed frontends
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.log("❌ CORS blocked origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
// Handle preflight
app.options("*", cors(corsOptions));

app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  console.log(`\n[LOG] ${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

/* ============================================================
   STATIC FILES
============================================================ */

// Serve uploads
const uploadsRootPath = path.join(__dirname, "uploads");
if (fs.existsSync(uploadsRootPath)) {
  console.log("Uploads folder found, serving at /uploads ...", uploadsRootPath);
  app.use("/uploads", express.static(uploadsRootPath));
} else {
  console.log("Uploads folder not found at:", uploadsRootPath);
}

// Serve Content Tree static content
const contentRootPath = path.join(__dirname, "../static-site/content");
if (fs.existsSync(contentRootPath)) {
  console.log("Content root found, serving at /content ...", contentRootPath);
  app.use("/content", express.static(contentRootPath));
} else {
  console.log("Content root not found at:", contentRootPath);
}

/* ============================================================
   HEALTHCHECK
============================================================ */

app.get("/api/health", (req, res) => {
  console.log("=== HEALTH ENDPOINT HIT ===");
  res.json({
    status: "OK",
    message: "LetsRevise API is running",
  });
});

/* ============================================================
   🔴 DIRECT LESSON CREATION ROUTE
   This bypasses the router bug for POST /api/lessons
============================================================ */

app.post("/api/lessons", auth, async (req, res) => {
  try {
    console.log("[CreateLesson] POST /api/lessons");
    if (!req.user) {
      console.error("❌ No user on request in lesson creation");
      return res.status(401).json({ msg: "No user on request" });
    }

    console.log("✅ Auth:", req.user.email, "type:", req.user.userType);

    if (req.user.userType !== "teacher") {
      return res
        .status(403)
        .json({ msg: "Only teachers can create lessons" });
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
    } = req.body || {};

    // ---- Validation ----
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
      console.log("❌ Validation failed, missing:", missing);
      return res.status(400).json({
        msg: "Please fill in all required fields",
        missing,
      });
    }

    // Normalise tags
    const tagsArray =
      typeof tags === "string"
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : Array.isArray(tags)
        ? tags
        : [];

    // Normalise resources
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
      isPublished: false,
    };

    // Optional extras
    if (board) lessonData.board = board;
    if (tier) lessonData.tier = tier;
    if (Array.isArray(uploadedImages) && uploadedImages.length > 0) {
      lessonData.uploadedImages = uploadedImages;
    }

    console.log("Saving lesson with payload:", lessonData);

    const lesson = new Lesson(lessonData);
    await lesson.save();
    console.log("✅ Lesson saved:", lesson._id);

    // Award ShamCoins to teacher
    let updatedShamCoins = 0;
    try {
      const dbUser = await User.findById(req.user._id);
      if (dbUser) {
        dbUser.shamCoins = (dbUser.shamCoins || 0) + 50;
        await dbUser.save();
        updatedShamCoins = dbUser.shamCoins;
        console.log(
          "✅ Awarded 50 ShamCoins to teacher:",
          dbUser.email,
          "New balance:",
          updatedShamCoins
        );
      } else {
        console.warn(
          "⚠️ Could not find teacher in DB to award ShamCoins:",
          req.user._id
        );
      }
    } catch (coinErr) {
      console.error("⚠️ Failed to award ShamCoins:", coinErr);
      // Don't fail the request because of this
    }

    return res.json({
      success: true,
      msg: "Lesson created successfully! You earned 50 ShamCoins!",
      lesson,
      updatedShamCoins,
    });
  } catch (err) {
    console.error("❌ Lesson creation error (direct route):");
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);

    return res.status(500).json({
      success: false,
      error: "Server error",
      message: err.message,
    });
  }
});

/* ============================================================
   OTHER API ROUTES (unchanged)
============================================================ */

app.use("/api/auth", authRoutes);
app.use("/api/lessons", lessonRoutes); // now handles only GET/PUT/DELETE/etc.
app.use("/api/earnings", earningsRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/content-tree", contentTreeRoutes);
console.log("Mounting /api/quizzes routes...");
app.use("/api/quizzes", quizzesRoutes);

// Helpful API 404
app.use("/api", (req, res) => {
  return res.status(404).json({
    msg: "API route not found",
    path: req.originalUrl,
  });
});

/* ============================================================
   STATIC SITE
============================================================ */

const staticSitePath = path.join(__dirname, "../static-site/website");
console.log("Static site path:", staticSitePath);

if (fs.existsSync(staticSitePath)) {
  console.log("Static site found, serving files...");
  app.use(express.static(staticSitePath));
} else {
  console.log("Static site not found at:", staticSitePath);
  console.log("Current directory:", __dirname);
}

// Serve index.html
app.get("/", (req, res) => {
  const indexFile = path.join(staticSitePath, "index.html");
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).send("Index.html not found");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`Quizzes: http://localhost:${PORT}/api/quizzes`);
  console.log(
    `Content Tree API: http://localhost:${PORT}/api/content-tree?stage=ks3`
  );
  console.log(`Uploads: http://localhost:${PORT}/uploads`);
  console.log(`Static site served from: ${staticSitePath}`);
  console.log(`Open browser at: http://localhost:${PORT}`);
});
