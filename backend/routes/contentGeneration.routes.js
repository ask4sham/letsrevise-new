/**
 * PR-014: Content generation routes — starter pack.
 */
const express = require("express");
const auth = require("../middleware/auth");
const contentGenerationRateLimit = require("../middleware/contentGenerationRateLimit");
const { postStarterPack, postWeakEvidenceFix, postPracticeSet, getJobs } = require("../controllers/contentGeneration.controller");

const router = express.Router();

router.use(auth);
router.use(contentGenerationRateLimit);

router.post("/starter-pack", postStarterPack);
router.post("/weak-evidence-fix", postWeakEvidenceFix);
router.post("/practice-set", postPracticeSet);
router.get("/jobs", getJobs);

module.exports = router;
