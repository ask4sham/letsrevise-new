// backend/app.js — canonical Express composition (middleware + routes + errors).
// server.js owns startup (Mongo, indexes) and listen only.
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

// Fail fast when AI is enabled but OPENAI_API_KEY is missing (avoids confusing 500s later)
// Skip in test so Jest can load the app without a key; individual tests set DISABLE_OPENAI=1 or OPENAI_API_KEY
if (
  process.env.NODE_ENV !== "test" &&
  process.env.DISABLE_OPENAI !== "1" &&
  !process.env.OPENAI_API_KEY
) {
  console.error("Missing required environment variable: OPENAI_API_KEY");
  console.error("Set OPENAI_API_KEY in backend/.env or set DISABLE_OPENAI=1 to disable AI features.");
  process.exit(1);
}

const { FILE_STORAGE_PATH, PUBLIC_VISUALS_DIR } = require("./config/paths");
const uploadsDir = FILE_STORAGE_PATH;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Created uploads directory:", uploadsDir);
}

const { isTruthyEnv } = require("./config/storage");
if (process.env.NODE_ENV === "production" && !isTruthyEnv("REQUIRE_CLOUD_UPLOADS")) {
  console.warn(
    "[storage] WARNING: production without REQUIRE_CLOUD_UPLOADS — uploads may fall back to local disk. " +
      "Set REQUIRE_CLOUD_UPLOADS=true once Supabase or R2 is configured."
  );
}

const { cors, corsMiddleware, getCorsOptions, logCorsConfigAtStartup } = require("./config/cors");
const { shouldServeLocalPublicVisuals } = require("./config/visualsServing");
const bodyLimit = require("./middleware/bodyLimit");
const { createBulkLimiter, createUploadLimiter, createAttemptLimiter } = require("./middleware/rateLimitBulk");
const auth = require("./middleware/auth");
const requireAdmin = require("./middleware/requireAdmin");

const sentryPath = path.join(__dirname, "config", "sentry.js");
let Sentry = null;
if (fs.existsSync(sentryPath)) {
  try {
    Sentry = require("./config/sentry").Sentry;
  } catch (err) {
    console.warn("[Sentry] Not initialized:", err.message);
  }
}

const app = express();
app.set("trust proxy", 1);

/* ============================================================
   A–B. Security headers then CORS
============================================================ */
app.use(helmet());
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});

logCorsConfigAtStartup();
app.options("*", (req, res, next) => cors(getCorsOptions())(req, res, next));
app.use(corsMiddleware);

if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`\n[LOG] ${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });
}

/* ============================================================
   Stripe webhook — raw body BEFORE JSON parser (B3)
============================================================ */
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  require("./routes/stripeWebhooks")
);

/* ============================================================
   C. Parsers
============================================================ */
app.use(bodyLimit);

const JSON_LIMIT = "2mb";
app.use((req, res, next) => {
  const contentType = (req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("multipart/form-data")) {
    return next();
  }
  if (!contentType.includes("application/json")) {
    return express.json({ limit: JSON_LIMIT })(req, res, next);
  }
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const buf = Buffer.concat(chunks);
    const hasUtf16LeBom = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe;
    const looksUtf16Le = buf.length >= 2 && buf[0] === 0x7b && buf[1] === 0x00;
    let str = hasUtf16LeBom || looksUtf16Le ? buf.toString("utf16le") : buf.toString("utf8");
    if (!hasUtf16LeBom && !looksUtf16Le && str.length > 0 && str.charCodeAt(0) === 0xfeff) str = str.slice(1);
    try {
      req.body = str && str.trim() ? JSON.parse(str) : {};
    } catch (e) {
      if (!(hasUtf16LeBom || looksUtf16Le)) {
        try {
          str = buf.toString("utf16le");
          req.body = str && str.trim() ? JSON.parse(str) : {};
          return next();
        } catch (_) {}
      }
      const err = new SyntaxError(e.message);
      err.status = 400;
      err.body = str;
      return next(err);
    }
    next();
  });
  req.on("error", next);
});

/* ============================================================
   D. Health / readiness / config (before global API limiter)
============================================================ */
function getCommit() {
  return process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || "unknown";
}

function jwtSecretFingerprint() {
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
  return process.env.DEBUG_ENDPOINTS === "1" || process.env.DEBUG_ENDPOINTS === "true";
}

app.get("/api/health", (req, res) => {
  const mongoose = require("mongoose");
  const mongoReady = mongoose.connection.readyState === 1;
  res.json({
    status: "OK",
    message: "LetsRevise API is running",
    commit: getCommit(),
    mongo: mongoReady ? "connected" : "disconnected",
  });
});

const ASSET_BASE_URL = (process.env.BACKEND_PUBLIC_URL || "https://letsrevise-new.onrender.com")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api\/?$/, "");
app.get("/api/config", (req, res) => {
  res.json({ assetBaseUrl: ASSET_BASE_URL });
});

app.get("/api/ready", async (req, res) => {
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: "not ready",
        mongo: "disconnected",
        readyState: mongoose.connection.readyState,
      });
    }
    try {
      await mongoose.connection.db.admin().command({ ping: 1 });
    } catch (pingErr) {
      console.error("[api/ready] ping failed:", pingErr.message);
      return res.status(503).json({ status: "not ready", mongo: "ping_failed" });
    }
    res.json({ status: "ready", mongo: "connected" });
  } catch (e) {
    res.status(503).json({ status: "not ready", mongo: "error" });
  }
});

app.get("/api/upload-ping", (req, res) => {
  res.json({ ok: true, msg: "Upload routes active", ts: Date.now() });
});

app.get("/api/visuals/__ping", (req, res) => {
  res.json({
    ok: true,
    serveLocalVisuals: shouldServeLocalPublicVisuals(),
    visualsDirExists: fs.existsSync(PUBLIC_VISUALS_DIR),
    hint:
      "After migrating public/visuals to object storage, set REACT_APP_PUBLIC_VISUALS_CDN_URL to the public base (e.g. R2_PUBLIC_URL).",
  });
});

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
   E. Global API limiter (after health exclusions)
============================================================ */
// Production defaults unchanged. In Jest, skip unless FORCE_* is set so the suite
// is not IP-throttled now that the limiter precedes every API router.
function createApiLimiter() {
  if (process.env.NODE_ENV === "test" && process.env.FORCE_API_LIMITER !== "1") {
    return (req, res, next) => next();
  }
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_API_MAX || "300", 10),
    message: { error: "Too many requests" },
    standardHeaders: true,
    legacyHeaders: false,
  });
}
function createAuthLimiter() {
  if (process.env.NODE_ENV === "test" && process.env.FORCE_AUTH_LIMITER !== "1") {
    return (req, res, next) => next();
  }
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "50", 10),
  });
}
const apiLimiter = createApiLimiter();
app.use("/api", apiLimiter);

const authLimiter = createAuthLimiter();

/* ============================================================
   F. Static / public assets (canonical once)
============================================================ */
const videosFallbackPath = path.join(
  __dirname,
  "public",
  "visuals",
  "biology",
  "aqa-gcse",
  "cell-biology",
  "cell-structure"
);

app.use(
  "/uploads",
  express.static(FILE_STORAGE_PATH, {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  })
);
app.use("/uploads", (req, res, next) => {
  if (req.method !== "GET" || !req.path.startsWith("/videos/")) return next();
  const filename = req.path.replace(/^\/videos\//, "");
  const baseMatch = filename.match(/^\d+-(.+)\.(mp4|webm|mov)$/i);
  const baseFilename = baseMatch ? `${baseMatch[1]}.${baseMatch[2]}` : filename;
  const fallbackFile = path.join(videosFallbackPath, baseFilename);
  if (fs.existsSync(fallbackFile)) {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.sendFile(fallbackFile);
  }
  next();
});
if (process.env.RENDER !== "true") {
  const https = require("https");
  const RENDER_UPLOADS = process.env.BACKEND_PUBLIC_URL || "https://letsrevise-new.onrender.com";
  app.use("/uploads", (req, res, next) => {
    if (req.method !== "GET") return next();
    const upstream = `${RENDER_UPLOADS}${req.originalUrl}`;
    https
      .get(upstream, (upRes) => {
        if (upRes.statusCode !== 200) {
          res.status(upRes.statusCode);
          return res.end();
        }
        res.setHeader("Content-Type", upRes.headers["content-type"] || "application/octet-stream");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Access-Control-Allow-Origin", "*");
        upRes.pipe(res);
      })
      .on("error", () => next());
  });
}

const contentRootPath = path.join(__dirname, "../static-site/content");
if (fs.existsSync(contentRootPath)) {
  app.use("/content", express.static(contentRootPath));
}

if (shouldServeLocalPublicVisuals() && fs.existsSync(PUBLIC_VISUALS_DIR)) {
  app.use(
    "/visuals",
    express.static(PUBLIC_VISUALS_DIR, {
      setHeaders: (res) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Access-Control-Allow-Origin", "*");
      },
    })
  );
}

const publicPath = path.join(__dirname, "public");
if (fs.existsSync(publicPath)) {
  app.use("/static", express.static(publicPath));
}

/* ============================================================
   G. Application routes (one canonical mount each)
============================================================ */
const uploadsRouter = require("./routes/uploads");
const { isSupabaseStorageEnabled } = require("./services/supabaseStorage");
const { isR2Enabled } = require("./services/r2Storage");
const uploadStorageType = isSupabaseStorageEnabled() ? "supabase" : isR2Enabled() ? "r2" : "local";

app.get("/api/uploads/__ping", (req, res) =>
  res.json({ ok: true, route: "uploads", hasVideo: true, storage: uploadStorageType })
);
// Intentional alias: same secured chain as router.post("/video")
app.post("/api/uploads/video", ...uploadsRouter.videoUploadRoute);
app.use("/api/uploads", uploadsRouter);

app.use("/api/admin/media", require("./routes/adminMedia"));
app.use("/api/assessment-papers", require("./routes/assessmentPapers"));
app.use("/api/assessment-attempts", createAttemptLimiter(), require("./routes/assessmentAttempts"));
app.use("/api/assessment-items", require("./routes/assessmentItems"));

// Auth-specific limiter must run before the auth router (was previously bypassed)
app.use("/api/auth", authLimiter, require("./routes/auth"));

app.use("/api/me", require("./routes/me"));
app.use("/api/lessons", require("./routes/lessonRevisionPackExport.routes"));
app.use("/api/lessons", require("./routes/lessons"));
app.use("/api/teachers", require("./routes/teachers"));
app.use("/api/lesson-synthesiser", require("./routes/lessonSynthesiserDrafts"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/ai", require("./routes/aiLessonV2"));
app.use("/api/taxonomy", require("./routes/taxonomy"));
app.use("/api/admin/bulk-import", require("./routes/adminBulkImport"));
app.use("/api/import", require("./routes/importRoutes"));
app.use("/api/admin/student-teacher-links", require("./routes/adminStudentTeacherLinks"));
app.use("/api/student-classes", createBulkLimiter(), require("./routes/studentClasses"));
app.use("/api/student-class-invitations", require("./routes/studentClassInvitations"));
app.use("/api/student-class-memberships", require("./routes/studentClassMemberships"));
app.use("/api/admin/question-banks", require("./routes/adminQuestionBanks"));
app.use("/api/admin/exam-question-rationale-inventory", require("./routes/adminExamQuestionRationaleInventory"));
app.use("/api/admin/exam-question-rationale-candidates", require("./routes/adminExamQuestionRationaleCandidates"));
app.use("/api/admin/exam-question-rationale-review-context", require("./routes/adminExamQuestionRationaleReviewContext"));
app.use("/api/admin/taxonomy", require("./routes/adminTaxonomy"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/attempts", require("./routes/attempts"));
app.use("/api/lesson-issues", require("./routes/lessonIssues"));
app.use("/api/worksheets", require("./routes/worksheets"));
app.use("/api/worksheet-assignments", require("./routes/worksheetAssignments"));
app.use("/api/worksheet-attempts", createAttemptLimiter(), require("./routes/worksheetAttempts"));
app.use("/api/worksheet-reports", require("./routes/worksheetReports"));
app.use("/api/exam-questions", require("./routes/examQuestions"));
app.use("/api/topic-flashcards", createBulkLimiter(), require("./routes/topicFlashcards"));
app.use("/api/topic-quiz-questions", createBulkLimiter(), require("./routes/topicQuizQuestions"));
app.use("/api/practice", require("./routes/practice"));
app.use("/api/practice-attempts", require("./routes/practiceAttempts"));
app.use("/api/practice-sets", require("./routes/practiceSets"));
app.use("/api/topic-past-papers", createUploadLimiter(), require("./routes/topicPastPapers"));
app.use("/api/past-papers", require("./routes/pastPapers"));
app.use("/api/past-paper-questions/by-topic", require("./routes/pastPaperQuestionsByTopic"));
app.use("/api/past-paper-questions", require("./routes/pastPaperQuestions"));
app.use("/api/flashcard-bank", createBulkLimiter(), require("./routes/flashcardBank"));
app.use("/api/audit", require("./routes/audit"));
app.use("/api/spec-statements", require("./routes/specStatements.routes"));
app.use("/api/knowledge-documents", require("./routes/knowledgeDocuments"));
app.use("/api/knowledge", require("./routes/knowledgeDocuments"));
app.use("/api/feature-flags", require("./routes/featureFlags"));
app.use("/api/visual-explanations", require("./routes/visualExplanation"));
app.use("/api/diagram-assets", require("./routes/diagramAssets"));
app.use("/api/coverage", require("./routes/coverage.routes"));
app.use("/api/content-graph", require("./routes/contentGraph"));
app.use("/api/generate", require("./routes/contentGeneration.routes"));
app.use("/api/publish-gate", require("./routes/publishGate.routes"));
app.use("/api/sprint-order", require("./routes/sprintOrder.routes"));
app.use("/api/conversations", require("./routes/conversations.routes"));
app.use("/api/external-sources", require("./routes/externalSources.routes"));
app.use("/api/teacher-notes", require("./routes/teacherNotes.routes"));
// Complementary progress routers (no METHOD+path overlap): student signals then lesson progress/stats
app.use("/api/progress", require("./routes/progress.routes"));
app.use("/api/progress", require("./routes/progress"));
app.use("/api/mastery", require("./routes/mastery.routes"));
app.use("/api/study-coach", require("./routes/studyCoach.routes"));
app.use("/api/topic-summary", require("./routes/topicSummary.routes"));
app.use("/api/topic-summary", require("./routes/topicSummaryToLesson.routes"));
app.use("/api/topic-summary/export", require("./routes/topicSummaryExport.routes"));

let enquiryRouter = null;
app.use("/api/enquiry", (req, res, next) => {
  if (!enquiryRouter) {
    enquiryRouter = require("./routes/enquiry.routes");
  }
  return enquiryRouter(req, res, next);
});

app.use("/api/teacher/analytics", require("./routes/teacherAnalytics"));
app.use("/api/teacher/topic-coverage", require("./routes/topicCoverage"));
app.use("/api/teacher", require("./routes/teacher"));
app.use("/api/student", require("./routes/student"));
app.use("/api/catalogue", require("./routes/catalogue"));
app.use("/api/quiz-assignments", require("./routes/quizAssignments"));
app.use("/api/quiz-attempts", require("./routes/quizAttempts"));
app.use("/api/monitoring", require("./routes/monitoring"));
app.use("/api/dev", require("./routes/devTools"));

// Former server-only mounts
app.use("/api/earnings", require("./routes/earnings"));
app.use("/api/users", require("./routes/users"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/subscriptions", require("./routes/subscriptions"));
app.use("/api/payouts", require("./routes/payouts"));
app.use("/api/pricing", require("./routes/pricing"));
app.use("/api/events", require("./routes/events"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/ops", require("./routes/ops"));
app.use("/api/autopilot-safety", require("./routes/autopilotSafety"));
app.use("/api/autopilot0", require("./routes/autopilot0"));
app.use("/api/ai-generation-jobs", require("./routes/aiGenerationJobs"));
app.use("/api/content-tree", require("./routes/content-tree"));
app.use("/api/visuals", require("./routes/visuals"));
app.use("/api/quizzes", require("./routes/quizzes"));
app.use("/api/parent-link", require("./routes/parentLink"));
app.use("/api/parent", require("./routes/parent"));
app.use("/api/templates", require("./routes/templates.routes"));
app.use("/api/curriculum-confidence", require("./routes/curriculumConfidence"));

const adminOpsPath = path.join(__dirname, "views", "admin-ops.html");
const gateHtml =
  "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Ops Admin — Login</title></head><body>" +
  "<h1>Ops Admin</h1><p>Authentication required. Paste your admin JWT and click Open.</p>" +
  "<label>Token: <input type='password' id='jwt' style='width:20em' placeholder='Paste JWT' /></label> " +
  "<button id='gateOpen'>Open</button><div id='gateErr' style='color:#c00;margin-top:0.5em'></div>" +
  "<script>" +
  "function showError(msg){document.getElementById('gateErr').textContent=msg||'';}" +
  "async function openPanel(){" +
  "var token=(document.getElementById('jwt').value||'').trim().replace(/^Bearer\\s+/i,'');" +
  "if(!token){showError('Paste a token.');return;}" +
  "showError('Loading...');" +
  "var res=await fetch('/admin/ops',{headers:{'Authorization':'Bearer '+token}});" +
  "if(!res.ok){showError('Unauthorized. Paste a valid admin token.');return;}" +
  "var html=await res.text();" +
  "document.open();document.write(html);document.close();" +
  "var attempts=0;var t=setInterval(function(){attempts++;if(typeof window.__setAdminToken==='function'){clearInterval(t);window.__setAdminToken(token);}else if(attempts>20){clearInterval(t);}},50);" +
  "}" +
  "document.getElementById('gateOpen').onclick=openPanel;" +
  "</script>" +
  "</body></html>";

app.get(
  "/admin/ops",
  (req, res, next) => {
    const hasAuth = req.get("Authorization") || req.get("x-auth-token");
    if (!hasAuth) {
      res.status(401).setHeader("Content-Type", "text/html");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("Referrer-Policy", "no-referrer");
      return res.send(gateHtml);
    }
    next();
  },
  auth,
  requireAdmin,
  (req, res) => {
    if (!fs.existsSync(adminOpsPath)) {
      return res.status(404).send("Admin ops page not found");
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'"
    );
    res.sendFile(adminOpsPath);
  }
);

app.get("/api/lesson_reviews", (req, res) => res.json([]));
app.get("/lesson_reviews", (req, res) => res.json([]));

/* ============================================================
   H. API 404 (before SPA)
============================================================ */
app.use("/api", (req, res) => {
  res.status(404).json({ msg: "API route not found" });
});

/* ============================================================
   I. SPA / static-site fallback
============================================================ */
const staticSitePath = path.join(__dirname, "../static-site/website");
const docsPath = path.join(staticSitePath, "docs");
if (fs.existsSync(docsPath)) {
  app.use("/docs", express.static(docsPath));
}
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
   J. Final error handlers
============================================================ */
if (Sentry && process.env.SENTRY_DSN) {
  try {
    Sentry.setupExpressErrorHandler(app);
  } catch (err) {
    console.warn("[Sentry] setupExpressErrorHandler skipped:", err.message);
  }
}

app.use((err, req, res, next) => {
  const isJsonSyntaxError = err instanceof SyntaxError && err.status === 400 && "body" in err;
  if (isJsonSyntaxError) {
    return res.status(400).json({
      error: "Invalid JSON",
      message: "Malformed JSON body",
    });
  }
  return next(err);
});

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const msg = status === 500 ? "Unhandled server error" : "Request failed";
  const safeMessage =
    process.env.NODE_ENV === "production" && status === 500 ? "Internal error" : err?.message || "Unknown error";
  console.error("[unhandled]", err);
  res.status(status).json({ error: msg, message: safeMessage, msg: safeMessage, code: "INTERNAL_ERROR" });
});

/** Mount inventory for composition tests (paths only; not registration order). */
app.locals.compositionMeta = {
  intentionalAliases: ["POST /api/uploads/video"],
  progressRouters: ["progress.routes", "progress"],
};

module.exports = app;
