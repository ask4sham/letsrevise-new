/**
 * PR-029: POST /api/topic-summary/to-lesson — convert topic summary to draft lesson.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const topicSummaryToLessonRateLimit = require("../middleware/topicSummaryToLessonRateLimit");
const { postTopicSummaryToLesson } = require("../controllers/topicSummaryToLesson.controller");

router.post("/to-lesson", auth, topicSummaryToLessonRateLimit, postTopicSummaryToLesson);

module.exports = router;
