/**
 * PR-025: Topic summary PDF export routes.
 * No multer/raw-body: body parsed by express.json() in app.js.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const topicSummaryExportRateLimit = require("../middleware/topicSummaryExportRateLimit");
const { postTopicSummaryExport } = require("../controllers/topicSummaryExport.controller");

router.use(auth);
router.post("/", topicSummaryExportRateLimit, postTopicSummaryExport);

module.exports = router;
