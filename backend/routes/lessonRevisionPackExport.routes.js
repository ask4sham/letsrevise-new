/**
 * Lesson Revision Pack PDF V1 routes.
 * Mounted at /api/lessons
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireLessonAccess = require("../middleware/requireLessonAccess");
const lessonRevisionPackExportRateLimit = require("../middleware/lessonRevisionPackExportRateLimit");
const { postLessonRevisionPackExport } = require("../controllers/lessonRevisionPackExport.controller");

router.post(
  "/:lessonId/export/revision-pack",
  auth,
  lessonRevisionPackExportRateLimit,
  requireLessonAccess(),
  postLessonRevisionPackExport
);

module.exports = router;
