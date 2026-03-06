/**
 * PR-014.1 / PR-014.1a: Publish gate routes — check and publish generated content.
 */
const express = require("express");
const auth = require("../middleware/auth");
const publishGateRateLimit = require("../middleware/publishGateRateLimit");
const { getCheck, postPublish } = require("../controllers/publishGate.controller");

const router = express.Router();

router.use(auth);
router.use(publishGateRateLimit);

router.get("/check", getCheck);
router.post("/publish", postPublish);

module.exports = router;
