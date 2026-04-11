// backend/server.js
const express = require("express");
const dotenv = require("dotenv");
const helmet = require("helmet"); // ✅ security headers
const rateLimit = require("express-rate-limit"); // ✅ rate limiting
const crypto = require("crypto"); // ✅ for safe JWT_SECRET fingerprint

// ✅ Load .env first
dotenv.config();

// Sentry: optional — do not crash if config/sentry.js is missing (e.g. before first deploy)
const path = require("path");
const fs = require("fs");
const sentryPath = path.join(__dirname, "config", "sentry.js");
if (fs.existsSync(sentryPath)) {
  try {
    const { initSentry } = require("./config/sentry");
    if (initSentry()) {
      console.log("  Sentry: enabled");
    } else {
      console.log("  Sentry: disabled (SENTRY_DSN not set)");
    }
  } catch (err) {
    console.warn("[Sentry] Not initialized:", err.message);
  }
} else {
  console.warn("[Sentry] config/sentry.js not found — skipping");
}

console.log("\n>>> BACKEND STARTING", new Date().toISOString(), "<<<\n");

// ✅ DEBUG: Check JWT_SECRET_KEY is loaded
console.log("🔐 Environment check:");
console.log("  JWT_SECRET_KEY exists:", !!process.env.JWT_SECRET_KEY);
console.log("  JWT_SECRET_KEY length:", process.env.JWT_SECRET_KEY ? process.env.JWT_SECRET_KEY.length : "N/A");
console.log("  JWT_SECRET exists:", !!process.env.JWT_SECRET);
console.log("  JWT_SECRET length:", process.env.JWT_SECRET ? process.env.JWT_SECRET.length : "N/A");

const { logEnquiryTutorStartup } = require("./services/llm/provider");
logEnquiryTutorStartup();

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
const opsRoutes = require("./routes/ops");
const aiRoutes = require("./routes/ai");
const aiGenerationJobsRoutes = require("./routes/aiGenerationJobs");
const contentTreeRoutes = require("./routes/content-tree");
const quizzesRoutes = require("./routes/quizzes");
const assessmentPapersRoutes = require("./routes/assessmentPapers");

// ✅ NEW: assessment items routes
const assessmentItemsRoutes = require("./routes/assessmentItems");

// ✅ NEW: assessment attempts routes
const assessmentAttemptsRoutes = require("./routes/assessmentAttempts");

// ✅ NEW: exam question bank (teacher only)
const examQuestionsRoutes = require("./routes/examQuestions");

// PR-W1: worksheets (teacher/admin only)
const worksheetsRoutes = require("./routes/worksheets");

// ✅ NEW: parent-link approval routes
const parentLinkRoutes = require("./routes/parentLink");

// ✅ NEW: template routes
const templateRoutes = require("./routes/templates.routes");

const curriculumConfidenceRouter = require("./routes/curriculumConfidence");
const pricingRoutes = require("./routes/pricing");
const eventRoutes = require("./routes/events");
const auditRoutes = require("./routes/audit");
// AI Generation Jobs routes are part of the overall API surface and are
// intentionally mounted early as placeholders; they currently have no
// handlers or behavior and serve only to stabilise route namespaces.

// We already have app from app.js, so we don't create a new one
// const app = express(); // REMOVED - using imported app instead
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

/* ============================================================
   MongoDB: connect BEFORE accepting HTTP traffic (avoids Mongoose
   "buffering timed out" when requests arrive before connect completes).
============================================================ */

/* ============================================================
   CORS: Handled in app.js (runs first for all requests).
   OPTIONS preflight is handled by cors middleware there.
============================================================ */

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

// Serve uploads (configurable via FILE_STORAGE_PATH)
const { FILE_STORAGE_PATH } = require("./config/paths");
const uploadsRootPath = FILE_STORAGE_PATH;
const videosFallbackPath = path.join(__dirname, "public", "visuals", "biology", "aqa-gcse", "cell-biology", "cell-structure");
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
  // Fallback: old /uploads/videos/xxx URLs → serve from visuals/biology/aqa-gcse/cell-biology/cell-structure (e.g. magnification.mp4)
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
  // Fallback: when running locally, proxy missing uploads from production Render (old lessons)
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

// Serve visuals (optional after CDN migration — see config/visualsServing.js)
const { PUBLIC_VISUALS_DIR } = require("./config/paths");
const { shouldServeLocalPublicVisuals } = require("./config/visualsServing");
const visualsRootPath = PUBLIC_VISUALS_DIR;
if (shouldServeLocalPublicVisuals() && fs.existsSync(visualsRootPath)) {
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
} else if (!shouldServeLocalPublicVisuals()) {
  console.log(
    "Skipping local /visuals static (SERVE_LOCAL_PUBLIC_VISUALS=false or SKIP_LOCAL_VISUALS_STATIC). Use CDN + REACT_APP_PUBLIC_VISUALS_CDN_URL."
  );
} else {
  console.log("Visuals folder not found at:", visualsRootPath);
}

app.get("/api/visuals/__ping", (req, res) => {
  res.json({
    ok: true,
    serveLocalVisuals: shouldServeLocalPublicVisuals(),
    visualsDirExists: fs.existsSync(visualsRootPath),
    hint:
      "After migrating public/visuals to object storage, set REACT_APP_PUBLIC_VISUALS_CDN_URL to the public base (e.g. R2_PUBLIC_URL).",
  });
});

// Static assets (admin-ops.js for CSP script-src 'self')
const publicPath = path.join(__dirname, "public");
if (fs.existsSync(publicPath)) {
  app.use("/static", express.static(publicPath));
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
  const mongoose = require("mongoose");
  const mongoReady = mongoose.connection.readyState === 1;
  res.json({
    status: "OK",
    message: "LetsRevise API is running",
    commit: getCommit(),
    mongo: mongoReady ? "connected" : "disconnected",
  });
});

// Public config for frontend (asset URLs, etc.). No auth required.
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

// Diagnostic: if this returns 200, server.js is running our code
app.get("/api/upload-ping", (req, res) => {
  res.json({ ok: true, msg: "Upload routes active", ts: Date.now() });
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

// General API rate limit (applies to all /api before route handlers)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_API_MAX || "300", 10),
  message: { error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

// Uploads router (direct /__ping and /video are in app.js)
app.use("/api/uploads", require("./routes/uploads"));
const { isSupabaseStorageEnabled } = require("./services/supabaseStorage");
const { isR2Enabled } = require("./services/r2Storage");
const storageLabel = isSupabaseStorageEnabled() ? "Supabase" : isR2Enabled() ? "R2" : "local";
console.log("[server] Uploads mounted at /api/uploads", `(${storageLabel})`);
console.log("[server] Supabase enabled:", !!process.env.SUPABASE_URL, !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("[server] SUPABASE_URL:", process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.slice(0, 40)}...` : "not set");
console.log("[server] SUPABASE_MEDIA_BUCKET:", process.env.SUPABASE_MEDIA_BUCKET || "lesson-media (default)");

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
app.use("/api/pricing", pricingRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ops", opsRoutes);
app.use("/api/ai", aiRoutes);
// AI generation jobs API namespace (placeholder router with no handlers yet; behavior will be added incrementally)
app.use("/api/ai-generation-jobs", aiGenerationJobsRoutes);
app.use("/api/content-tree", contentTreeRoutes);
app.use("/api/visuals", require("./routes/visuals"));
app.use("/api/taxonomy", require("./routes/taxonomy"));
app.use("/api/quizzes", quizzesRoutes);
app.use("/api/assessment-papers", assessmentPapersRoutes);

// ✅ Add assessment items routes
app.use("/api/assessment-items", assessmentItemsRoutes);

// ✅ Add assessment attempts routes
app.use("/api/assessment-attempts", assessmentAttemptsRoutes);

app.use("/api/exam-questions", examQuestionsRoutes);
app.use("/api/topic-flashcards", require("./routes/topicFlashcards"));
app.use("/api/topic-quiz-questions", require("./routes/topicQuizQuestions"));
app.use("/api/topic-past-papers", require("./routes/topicPastPapers"));
app.use("/api/flashcard-bank", require("./routes/flashcardBank"));
app.use("/api/worksheets", worksheetsRoutes);

// PR-W4: Worksheet assignment + student attempt
app.use("/api/worksheet-assignments", require("./routes/worksheetAssignments"));
app.use("/api/worksheet-attempts", require("./routes/worksheetAttempts"));
app.use("/api/worksheet-reports", require("./routes/worksheetReports"));

app.use("/api/parent-link", parentLinkRoutes);
app.use("/api/parent", require("./routes/parent"));

// ✅ NEW: Add template routes
app.use("/api/templates", templateRoutes);

app.use("/api/curriculum-confidence", curriculumConfidenceRouter);

// PR10: Biology readiness report (teacher/admin)
app.use("/api/reports", require("./routes/reports"));

// PR12: Practice/checkpoint attempts
app.use("/api/attempts", require("./routes/attempts"));

// Lesson issue reports (students/teachers submit; admin/teachers manage)
app.use("/api/lesson-issues", require("./routes/lessonIssues"));

// PR-W2.3: Dev-only seed endpoints (ENABLE_DEV_TOOLS=1; teacher/admin)
app.use("/api/dev", require("./routes/devTools"));

/* ============================================================
   Phase 12.2: Admin Ops UI (read-only + controls) — Patched 12A/12D
   Protected with auth + requireAdmin; 401 returns gate page for token entry.
============================================================ */
const auth = require("./middleware/auth");
const requireAdmin = require("./middleware/requireAdmin");
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

app.get("/admin/ops", (req, res, next) => {
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
}, auth, requireAdmin, (req, res) => {
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
});

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

// Serve /docs (e.g. teacher guide PDF) before general static so SPA fallback never swallows them
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
   SENTRY ERROR HANDLER (must be after all routes)
============================================================ */
if (fs.existsSync(sentryPath)) {
  try {
    const { Sentry } = require("./config/sentry");
    if (Sentry && process.env.SENTRY_DSN) {
      Sentry.setupExpressErrorHandler(app);
      console.log("[Sentry] Express error handler registered");
    }
  } catch (err) {
    console.warn("[Sentry] setupExpressErrorHandler skipped:", err.message);
  }
}

/* ============================================================
   START SERVER
============================================================ */

function tryListen(port) {
  const server = app.listen(port, () => {
    console.log(`\n=== Server running on port ${port} (${new Date().toISOString()}) ===`);
    console.log(`Health: http://localhost:${port}/api/health`);
    console.log(`Ready (Mongo): http://localhost:${port}/api/ready`);
    console.log(`Uploads ping: http://localhost:${port}/api/uploads/__ping`);
    console.log(`Uploads: http://localhost:${port}/uploads`);
    console.log(`Visuals: http://localhost:${port}/visuals`);
    console.log(`Templates: http://localhost:${port}/api/templates`);
    console.log(`Assessment Items: http://localhost:${port}/api/assessment-items`);
    console.log(`Assessment Papers: http://localhost:${port}/api/assessment-papers`);
    console.log(`Assessment Attempts: http://localhost:${port}/api/assessment-attempts`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && port < 5010) {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      tryListen(port + 1);
    } else {
      throw err;
    }
  });
}

(async function startServer() {
  try {
    require("./utils/jwtSecret").getJwtSecret();
  } catch (e) {
    console.error("[FATAL] JWT secret missing. Set JWT_SECRET or JWT_SECRET_KEY in environment.");
    process.exit(1);
  }
  try {
    await connectDB();
  } catch (err) {
    console.error("[MongoDB] FATAL: could not connect. Exiting so the platform can restart.");
    process.exit(1);
  }
  tryListen(PORT);
})();