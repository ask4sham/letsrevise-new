/**
 * Test-only Express app for safe current-user / self-profile DTO integration tests.
 *
 * Production mounts /api/users only from server.js (after Helmet).
 * Do not import this helper from app.js or server.js.
 */
const express = require("express");

function createUsersRouteTestApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  // Real routers — exercises auth middleware, User model, and DTO serializers.
  app.use("/api/auth", require("../../routes/auth"));
  app.use("/api/users", require("../../routes/users"));
  return app;
}

module.exports = { createUsersRouteTestApp };
