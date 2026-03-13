/**
 * PR-019: Conversations API — threaded tutoring chat.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  createConversation,
  getConversation,
  listConversations,
} = require("../controllers/conversations.controller");

router.post("/", auth, createConversation);
router.get("/", auth, listConversations);
router.get("/:id", auth, getConversation);

module.exports = router;
