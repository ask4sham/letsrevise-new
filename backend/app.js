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

// ✅ Export for testing
module.exports = app;