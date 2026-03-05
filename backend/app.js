// backend/app.js
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");

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

// Ensure uploads directory exists (diagram and other uploads)
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Created uploads directory:", uploadsDir);
}
const cors = require("cors");
const bodyLimit = require("./middleware/bodyLimit");
const { createBulkLimiter, createUploadLimiter, createAttemptLimiter } = require("./middleware/rateLimitBulk");
const app = express();

// ✅ CORS configuration to allow frontend origin
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

// PR-HARD-2: Reject oversized bulk/upload payloads before parsing (413)
app.use(bodyLimit);

// JSON body parser: strip BOM (PowerShell ConvertTo-Json can emit it) then parse
const JSON_LIMIT = "2mb";
app.use((req, res, next) => {
  const contentType = req.headers["content-type"] || "";
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

// PR-BULK-INGEST-3: Serve uploaded files (local storage)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// PR-BULK-INGEST-3: Admin media upload (store + reference + dedupe)
app.use("/api/admin/media", require("./routes/adminMedia"));

// Uploads: image + lesson-media (CreateLessonPage) — must be registered so proxy gets 200
app.use("/api/uploads", require("./routes/uploads"));

// ✅ Register routes that are needed for tests (add any others as needed)
app.use("/api/assessment-papers", require("./routes/assessmentPapers"));
app.use("/api/assessment-attempts", createAttemptLimiter(), require("./routes/assessmentAttempts"));
app.use("/api/assessment-items", require("./routes/assessmentItems"));

// ✅ Add auth routes if your assessment endpoints need auth middleware
app.use("/api/auth", require("./routes/auth"));

// ✅ Phase 9B: me/entitlements (auth-only, non-sensitive)
app.use("/api/me", require("./routes/me"));

// ✅ Add lessons route for Phase 9 content-access integration tests
app.use("/api/lessons", require("./routes/lessons"));

// Phase 9D: reviews (lesson workflow approve/reject)
app.use("/api/reviews", require("./routes/reviews"));

// PR3: AQA GCSE Biology lesson factory
app.use("/api/ai", require("./routes/ai"));

// Canonical taxonomy (teacher UI topic picker, diagram mapping)
app.use("/api/taxonomy", require("./routes/taxonomy"));

// PR-BULK-INGEST-1: Admin bulk import (flashcards; validate + dedupe + dry-run)
app.use("/api/admin/bulk-import", require("./routes/adminBulkImport"));
app.use("/api/admin/student-teacher-links", require("./routes/adminStudentTeacherLinks"));

// PR10: Biology readiness report (teacher/admin)
app.use("/api/reports", require("./routes/reports"));

// PR12: Practice/checkpoint attempts (record only)
app.use("/api/attempts", require("./routes/attempts"));

// PR-W1: worksheets (teacher/admin only)
app.use("/api/worksheets", require("./routes/worksheets"));

// PR-W4: worksheet assignment + attempts + reports + PR-HARD-2 rate limit on attempts
app.use("/api/worksheet-assignments", require("./routes/worksheetAssignments"));
app.use("/api/worksheet-attempts", createAttemptLimiter(), require("./routes/worksheetAttempts"));
app.use("/api/worksheet-reports", require("./routes/worksheetReports"));

// PR-W2: exam question bank (teacher/admin; topicKey, draft/published)
app.use("/api/exam-questions", require("./routes/examQuestions"));

// PR-F1: topic flashcard bank (teacher/admin only) + PR-HARD-2 rate limit
app.use("/api/topic-flashcards", createBulkLimiter(), require("./routes/topicFlashcards"));

// PR-Q1: topic quiz bank (teacher/admin only) + PR-HARD-2 rate limit
app.use("/api/topic-quiz-questions", createBulkLimiter(), require("./routes/topicQuizQuestions"));

// PR-PRACTICE-LOOP-1: student practice set + attempt tracking + teacher topic stats
app.use("/api/practice", require("./routes/practice"));
app.use("/api/practice-attempts", require("./routes/practiceAttempts"));
app.use("/api/practice-sets", require("./routes/practiceSets"));

// PR-PP1: topic past paper bank (teacher/admin only) + PR-HARD-2 rate limit
app.use("/api/topic-past-papers", createUploadLimiter(), require("./routes/topicPastPapers"));

// PR-PAST-PAPERS-API-1: teacher-owned PastPaper records (mine + filtering)
app.use("/api/past-papers", require("./routes/pastPapers"));

// PR-PAST-PAPERS-UI-2: past paper questions (mine + link)
app.use("/api/past-paper-questions/by-topic", require("./routes/pastPaperQuestionsByTopic"));
app.use("/api/past-paper-questions", require("./routes/pastPaperQuestions"));

// PR-F1: flashcard bank (one doc per topicKey, import + copy-to-lesson) + PR-HARD-2 rate limit
app.use("/api/flashcard-bank", createBulkLimiter(), require("./routes/flashcardBank"));

// Audit: question bank (Content Coverage) + sprint order doc — single source of truth
app.use("/api/audit", require("./routes/audit"));

// PR-001: SpecStatement admin CRUD (AI Tutor knowledge layer)
app.use("/api/spec-statements", require("./routes/specStatements.routes"));

// PR-002: KnowledgeDocument debug API (admin only)
app.use("/api/knowledge-documents", require("./routes/knowledgeDocuments"));
// PR-003: Semantic search (teacher + admin) at /api/knowledge/search
app.use("/api/knowledge", require("./routes/knowledgeDocuments"));

// PR-007: Feature flags (auth required)
app.use("/api/feature-flags", require("./routes/featureFlags"));

// PR-009: Coverage engine (teacher + admin)
app.use("/api/coverage", require("./routes/coverage.routes"));

// PR-014: Content starter pack generator (teacher + admin, rate limited)
app.use("/api/generate", require("./routes/contentGeneration.routes"));

// PR-014.1: Publish gate — check and publish generated content (teacher + admin)
app.use("/api/publish-gate", require("./routes/publishGate.routes"));

// PR-012: Sprint order download (teacher + admin, rate limited)
app.use("/api/sprint-order", require("./routes/sprintOrder.routes"));

// PR-019: Conversations (threaded tutoring chat)
app.use("/api/conversations", require("./routes/conversations.routes"));

// PR-022: External source moderation (teacher/admin only)
app.use("/api/external-sources", require("./routes/externalSources.routes"));

// PR-023: Teacher notes listing (teacher/admin only)
app.use("/api/teacher-notes", require("./routes/teacherNotes.routes"));
app.use("/api/topic-summary", require("./routes/topicSummary.routes"));
app.use("/api/topic-summary/export", require("./routes/topicSummaryExport.routes"));

// PR-004: Enquiry (RAG) — teacher + admin + student (when flag enabled)
// Lazy-load to avoid pulling in vector DB / embeddings at app init (fixes Jest Babel parse in tests)
let enquiryRouter = null;
app.use("/api/enquiry", (req, res, next) => {
  if (!enquiryRouter) {
    enquiryRouter = require("./routes/enquiry.routes");
  }
  return enquiryRouter(req, res, next);
});

// PR-EDGE-3: Teacher overview dashboard (topic-coverage must be before /api/teacher so GET /api/teacher/topic-coverage hits it)
app.use("/api/teacher/analytics", require("./routes/teacherAnalytics"));
app.use("/api/teacher/topic-coverage", require("./routes/topicCoverage"));
app.use("/api/teacher", require("./routes/teacher"));

// PR-EDGE-4: Student My Work dashboard
app.use("/api/student", require("./routes/student"));

// PR-EDGE-4.1/4.2: Quiz/Assessment assignment share + attempt submit
app.use("/api/quiz-assignments", require("./routes/quizAssignments"));
app.use("/api/quiz-attempts", require("./routes/quizAttempts"));

// PR-W2.3: dev seed (ENABLE_DEV_TOOLS=1; 404 when disabled)
app.use("/api/dev", require("./routes/devTools"));

// JSON parse error (body-parser SyntaxError → 400, not 500)
app.use((err, req, res, next) => {
  const isJsonSyntaxError =
    err instanceof SyntaxError &&
    err.status === 400 &&
    "body" in err;

  if (isJsonSyntaxError) {
    return res.status(400).json({
      error: "Invalid JSON",
      message: "Malformed JSON body",
    });
  }

  return next(err);
});

// Global error guard (unhandled → 500; respects err.status when present)
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const msg = status === 500 ? "Unhandled server error" : "Request failed";
  const safeMessage =
    process.env.NODE_ENV === "production" && status === 500 ? "Internal error" : (err?.message || "Unknown error");
  console.error("[unhandled]", err);
  res.status(status).json({ error: msg, message: safeMessage });
});

// ✅ Export for testing
module.exports = app;