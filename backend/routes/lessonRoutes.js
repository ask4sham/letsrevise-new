const express = require("express");
const router = express.Router();

const { getLessonById } = require("../controllers/lessonController");
const auth = require("../middleware/auth"); // uses JWT

// GET lesson by ID (student / teacher / admin)
router.get("/lessons/:id", auth, getLessonById);

module.exports = router;
