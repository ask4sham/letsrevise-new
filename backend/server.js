// backend/server.js — infrastructure startup and listen only.
// Express composition (middleware, routes, 404, errors) lives in app.js.
const path = require("path");
const fs = require("fs");

// ✅ Load .env first (always from backend/.env, not process.cwd())
const { loadBackendEnv } = require("./config/loadEnv");
const envLoad = loadBackendEnv();

// Sentry: optional — do not crash if config/sentry.js is missing (e.g. before first deploy)
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
if (envLoad.loadedFrom) {
  console.log("  Env loaded from:", envLoad.loadedFrom);
}
console.log("  OPENAI/LLM API key:", envLoad.hasOpenAiKey ? "present" : "MISSING");

console.log("🔐 Environment check:");
console.log("  JWT_SECRET_KEY exists:", !!process.env.JWT_SECRET_KEY);
console.log("  JWT_SECRET_KEY length:", process.env.JWT_SECRET_KEY ? process.env.JWT_SECRET_KEY.length : "N/A");
console.log("  JWT_SECRET exists:", !!process.env.JWT_SECRET);
console.log("  JWT_SECRET length:", process.env.JWT_SECRET ? process.env.JWT_SECRET.length : "N/A");

const { logEnquiryTutorStartup } = require("./services/llm/provider");
logEnquiryTutorStartup();

const connectDB = require("./config/database");

// Fully composed Express app (middleware + routes + errors)
const app = require("./app");

const { isSupabaseStorageEnabled } = require("./services/supabaseStorage");
const { isR2Enabled } = require("./services/r2Storage");
const { supabaseUrlHost } = require("./config/logDataPlane");
const storageLabel = isSupabaseStorageEnabled() ? "Supabase" : isR2Enabled() ? "R2" : "local";
console.log("[server] App composition loaded; uploads storage:", storageLabel);
console.log("[server] Supabase enabled:", !!process.env.SUPABASE_URL, !!process.env.SUPABASE_SERVICE_ROLE_KEY);
const supHostEarly = supabaseUrlHost(process.env.SUPABASE_URL || "");
console.log("[server] Supabase URL host (not secret):", supHostEarly || "not set");
console.log("[server] SUPABASE_MEDIA_BUCKET:", process.env.SUPABASE_MEDIA_BUCKET || "lesson-media (default)");

const PORT = process.env.PORT || 5000;

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
  return server;
}

/**
 * Testable startup barrier: JWT → Mongo → Attempt-2 index → optional registry → listen.
 * Does not call listen until required checks succeed.
 */
async function startServer(options = {}) {
  const listenImpl = options.listen || tryListen;
  const connect = options.connectDB || connectDB;
  const ensureIndexes =
    options.ensureExamQuestionRationaleCandidateIndexes ||
    require("./services/examQuestionRationaleCandidateAttemptTwoIndex")
      .ensureExamQuestionRationaleCandidateIndexes;
  const refreshRegistry =
    options.refreshSpecTopicRegistryCache ||
    (() => require("./utils/specTopicRegistry").refreshSpecTopicRegistryCache());
  const port = options.port != null ? options.port : PORT;
  const exitFn = options.exit || ((code) => process.exit(code));

  try {
    require("./utils/jwtSecret").getJwtSecret();
  } catch (e) {
    console.error("[FATAL] JWT secret missing. Set JWT_SECRET or JWT_SECRET_KEY in environment.");
    exitFn(1);
    return null;
  }
  try {
    await connect();
  } catch (err) {
    console.error("[MongoDB] FATAL: could not connect. Exiting so the platform can restart.");
    exitFn(1);
    return null;
  }
  try {
    const indexResult = await ensureIndexes();
    console.log(
      "[ExamQuestionRationaleCandidate] Attempt-2 unique index ready:",
      indexResult.indexName,
      indexResult.created ? "(created)" : "(verified existing)"
    );
  } catch (err) {
    console.error(
      "[ExamQuestionRationaleCandidate] FATAL: Attempt-2 unique index uq_attempt2_generation_group " +
        "could not be ensured/verified. Refusing to listen.",
      err && err.code ? `code=${err.code}` : "",
      err && err.message ? err.message : err
    );
    exitFn(1);
    return null;
  }
  try {
    await refreshRegistry();
    console.log("[specTopicRegistry] admin sub-topic cache loaded");
  } catch (e) {
    console.warn("[specTopicRegistry] cache refresh skipped:", e?.message || e);
  }
  try {
    const { validateStripeBillingConfigAtStartup } = require("./config/stripe");
    validateStripeBillingConfigAtStartup();
    console.log("[stripe] billing config validated (local only)");
  } catch (err) {
    console.error("[stripe] FATAL: billing configuration invalid:", err?.message || err);
    exitFn(1);
    return null;
  }
  return listenImpl(port);
}

module.exports = { app, startServer, tryListen };

if (require.main === module) {
  startServer().catch((err) => {
    console.error("[FATAL] startup failed:", err);
    process.exit(1);
  });
}
