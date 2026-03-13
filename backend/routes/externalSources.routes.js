/**
 * PR-022: External source moderation — teacher/admin only.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  listPolicies,
  upsertPolicyHandler,
  deletePolicy,
  listRecent,
  promoteToTeacherNote,
} = require("../controllers/externalSources.controller");

router.use(auth);

router.get("/policies", listPolicies);
router.post("/policies", upsertPolicyHandler);
router.delete("/policies/:id", deletePolicy);
router.get("/recent", listRecent);
router.post("/promote", promoteToTeacherNote);

module.exports = router;
