// backend/app.js
require("dotenv").config();

const express = require("express");
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

// ✅ Add minimal essential middleware that Supertest needs (2MB global limit)
app.use(express.json({ limit: "2mb" }));

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

// PR-PP1: topic past paper bank (teacher/admin only) + PR-HARD-2 rate limit
app.use("/api/topic-past-papers", createUploadLimiter(), require("./routes/topicPastPapers"));
// PR-F1: flashcard bank (one doc per topicKey, import + copy-to-lesson) + PR-HARD-2 rate limit
app.use("/api/flashcard-bank", createBulkLimiter(), require("./routes/flashcardBank"));

// PR-EDGE-3: Teacher overview dashboard
app.use("/api/teacher", require("./routes/teacher"));

// PR-EDGE-4: Student My Work dashboard
app.use("/api/student", require("./routes/student"));

// PR-EDGE-4.1/4.2: Quiz/Assessment assignment share + attempt submit
app.use("/api/quiz-assignments", require("./routes/quizAssignments"));
app.use("/api/quiz-attempts", require("./routes/quizAttempts"));

// PR-W2.3: dev seed (ENABLE_DEV_TOOLS=1; 404 when disabled)
app.use("/api/dev", require("./routes/devTools"));

// ✅ Export for testing
module.exports = app;