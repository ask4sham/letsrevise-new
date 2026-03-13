/**
 * PR-038: Study coach API — personalised study plan.
 * Student only.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getPlan, getTopic } = require("../controllers/studyCoach.controller");

router.get("/plan", auth, getPlan);
router.get("/topic/:topicKey", auth, getTopic);

module.exports = router;
