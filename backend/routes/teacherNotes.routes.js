/**
 * PR-023: Teacher notes API — teacher/admin only.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { listTeacherNotes } = require("../controllers/teacherNotes.controller");

router.use(auth);
router.get("/", listTeacherNotes);

module.exports = router;
