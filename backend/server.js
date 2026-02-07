// backend/server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet"); // ✅ security headers
const rateLimit = require("express-rate-limit"); // ✅ rate limiting
const crypto = require("crypto"); // ✅ for safe JWT_SECRET fingerprint

// ✅ Load .env first
dotenv.config();

// ✅ DEBUG: Check JWT_SECRET_KEY is loaded
console.log("🔐 Environment check:");
console.log("  JWT_SECRET_KEY exists:", !!process.env.JWT_SECRET_KEY);
console.log("  JWT_SECRET_KEY length:", process.env.JWT_SECRET_KEY ? process.env.JWT_SECRET_KEY.length : "N/A");
console.log("  JWT_SECRET exists:", !!process.env.JWT_SECRET);
console.log("  JWT_SECRET length:", process.env.JWT_SECRET ? process.env.JWT_SECRET.length : "N/A");

const path = require("path");
const fs = require("fs");
const connectDB = require("./config/database");

// Import the app from app.js instead of creating new express app
const app = require("./app");

// Import routes
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
const aiGenerationJobsRoutes = require("./routes/aiGenerationJobs");
const contentTreeRoutes = require("./routes/content-tree");
const uploadsRoutes = require("./routes/uploads");
const quizzesRoutes = require("./routes/quizzes");
const assessmentPapersRoutes = require("./routes/assessmentPapers");

// ✅ NEW: assessment items routes
const assessmentItemsRoutes = require("./routes/assessmentItems");

// ✅ NEW: assessment attempts routes
const assessmentAttemptsRoutes = require("./routes/assessmentAttempts");

// ✅ NEW: exam question bank (teacher only)
const examQuestionsRoutes = require("./routes/examQuestions");

// ✅ NEW: parent-link approval routes
const parentLinkRoutes = require("./routes/parentLink");

// ✅ NEW: template routes
const templateRoutes = require("./routes/templates.routes");

const curriculumConfidenceRouter = require("./routes/curriculumConfidence");
// AI Generation Jobs routes are part of the overall API surface and are
// intentionally mounted early as placeholders; they currently have no
// handlers or behavior and serve only to stabilise route namespaces.

// We already have app from app.js, so we don't create a new one
// const app = express(); // REMOVED - using imported app instead
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

/* ============================================================
   CORS CONFIG
============================================================ */

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:4173",
  "https://profound-gumdrop-4c8d83.netlify.app",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.log("❌ CORS blocked origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// JSON parsing already in app.js, but we can add helmet here
app.use(helmet()); // ✅ enable Helmet after JSON parsing

// ✅ FINAL HARDENING (REQUIRED for images & visuals)
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});

// Simple request logger (dev only)
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`\n[LOG] ${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });
}

/* ============================================================
   STATIC FILES
============================================================ */

// Serve uploads
const uploadsRootPath = path.join(__dirname, "uploads");
if (fs.existsSync(uploadsRootPath)) {
  console.log("Uploads folder found, serving at /uploads ...", uploadsRootPath);

  app.use(
    "/uploads",
    express.static(uploadsRootPath, {
      setHeaders: (res) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Access-Control-Allow-Origin", "*");
      },
    })
  );
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

// Serve visuals
const visualsRootPath = path.join(__dirname, "public", "visuals");
if (fs.existsSync(visualsRootPath)) {
  console.log("Visuals folder found, serving at /visuals ...", visualsRootPath);

  app.use(
    "/visuals",
    express.static(visualsRootPath, {
      setHeaders: (res) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Access-Control-Allow-Origin", "*");
      },
    })
  );
} else {
  console.log("Visuals folder not found at:", visualsRootPath);
}

/* ============================================================
   DEBUG HELPERS
============================================================ */

function getCommit() {
  return process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || "unknown";
}

function jwtSecretFingerprint() {
  // ✅ CHANGED: Use JWT_SECRET_KEY instead of JWT_SECRET
  const raw = process.env.JWT_SECRET_KEY;
  const secret = typeof raw === "string" ? raw.trim() : "";
  if (!secret) return { ok: false, fingerprint: "JWT_SECRET_KEY missing" };

  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  return {
    ok: true,
    fingerprint: `len=${secret.length}, sha256=${hash.slice(0, 12)}…`,
  };
}

function debugEnabled() {
  return (
    process.env.DEBUG_ENDPOINTS === "1" ||
    process.env.DEBUG_ENDPOINTS === "true"
  );
}

/* ============================================================
   HEALTHCHECK
============================================================ */

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "LetsRevise API is running",
    commit: getCommit(),
  });
});

/* ============================================================
   DEBUG INFO
============================================================ */

app.get("/api/_debug/info", (req, res) => {
  if (!debugEnabled()) {
    return res.status(404).json({ msg: "API route not found" });
  }

  const fp = jwtSecretFingerprint();
  res.json({
    SERVER_DEBUG_ACTIVE: true,
    commit: getCommit(),
    jwtSecretOk: fp.ok,
    jwtSecretFingerprint: fp.fingerprint,
  });
});

/* ============================================================
   API ROUTES
============================================================ */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/earnings", earningsRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
// AI generation jobs API namespace (placeholder router with no handlers yet; behavior will be added incrementally)
app.use("/api/ai-generation-jobs", aiGenerationJobsRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/content-tree", contentTreeRoutes);
app.use("/api/visuals", require("./routes/visuals"));
app.use("/api/quizzes", quizzesRoutes);
app.use("/api/assessment-papers", assessmentPapersRoutes);

// ✅ Add assessment items routes
app.use("/api/assessment-items", assessmentItemsRoutes);

// ✅ Add assessment attempts routes
app.use("/api/assessment-attempts", assessmentAttemptsRoutes);

app.use("/api/exam-questions", examQuestionsRoutes);

app.use("/api/parent-link", parentLinkRoutes);
app.use("/api/parent", require("./routes/parent"));

// ✅ NEW: Add template routes
app.use("/api/templates", templateRoutes);

app.use("/api/curriculum-confidence", curriculumConfidenceRouter);

/* ============================================================
   COMPATIBILITY ROUTES
============================================================ */

app.get("/api/lesson_reviews", (req, res) => res.json([]));
app.get("/lesson_reviews", (req, res) => res.json([]));

/* ============================================================
   API 404
============================================================ */

app.use("/api", (req, res) => {
  res.status(404).json({ msg: "API route not found" });
});

/* ============================================================
   STATIC SITE
============================================================ */

const staticSitePath = path.join(__dirname, "../static-site/website");

if (fs.existsSync(staticSitePath)) {
  app.use(express.static(staticSitePath));
}

app.get("/", (req, res) => {
  const indexFile = path.join(staticSitePath, "index.html");
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).send("Index.html not found");
  }
});

/* ============================================================
   START SERVER
============================================================ */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`Uploads: http://localhost:${PORT}/uploads`);
  console.log(`Visuals: http://localhost:${PORT}/visuals`);
  console.log(`Templates: http://localhost:${PORT}/api/templates`);
  console.log(`Assessment Items: http://localhost:${PORT}/api/assessment-items`);
  console.log(`Assessment Papers: http://localhost:${PORT}/api/assessment-papers`);
  console.log(`Assessment Attempts: http://localhost:${PORT}/api/assessment-attempts`);
});