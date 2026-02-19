// backend/app.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();

// ✅ CORS configuration to allow frontend origin
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

// ✅ Add minimal essential middleware that Supertest needs
app.use(express.json());

// ✅ Register routes that are needed for tests (add any others as needed)
app.use("/api/assessment-papers", require("./routes/assessmentPapers"));
app.use("/api/assessment-attempts", require("./routes/assessmentAttempts"));
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

// PR10: Biology readiness report (teacher/admin)
app.use("/api/reports", require("./routes/reports"));

// PR12: Practice/checkpoint attempts (record only)
app.use("/api/attempts", require("./routes/attempts"));

// PR-W1: worksheets (teacher/admin only)
app.use("/api/worksheets", require("./routes/worksheets"));

// PR-W2.3: dev seed (ENABLE_DEV_TOOLS=1; 404 when disabled)
app.use("/api/dev", require("./routes/devTools"));

// ✅ Export for testing
module.exports = app;