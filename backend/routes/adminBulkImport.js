/**
 * PR-BULK-INGEST-1/2/4: Admin bulk import (flashcards, exam questions, past papers, past paper questions).
 * TODO: Replace with your existing admin auth middleware (e.g. requireAdmin).
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { bulkImportFlashcards } = require("../services/bulkImportFlashcards");
const { bulkImportExamQuestions } = require("../services/bulkImportExamQuestions");
const { bulkImportPastPapers } = require("../services/bulkImportPastPapers");
const { bulkImportPastPaperQuestions } = require("../services/bulkImportPastPaperQuestions");

router.post("/flashcards", async (req, res) => {
  try {
    const { specKey, items, dryRun } = req.body || {};
    const actorId = req.user?._id || req.user?.id || null;

    const report = await bulkImportFlashcards({
      specKey,
      items,
      dryRun: !!dryRun,
      actorId,
    });

    return res.status(200).json(report);
  } catch (e) {
    return res.status(400).json({
      error: e.message || "Bulk import failed",
    });
  }
});

router.post("/exam-questions", async (req, res) => {
  try {
    const { specKey, items, dryRun } = req.body || {};
    const actorId = req.user?.userId || req.user?._id || req.user?.id || null;

    const report = await bulkImportExamQuestions({
      specKey,
      items,
      dryRun: !!dryRun,
      actorId,
    });

    return res.status(200).json(report);
  } catch (e) {
    return res.status(400).json({
      error: e.message || "Bulk import failed",
    });
  }
});

router.post("/past-papers", auth, async (req, res) => {
  try {
    const { specKey, items, dryRun } = req.body || {};
    const actorId = req.user?._id || req.user?.id || req.user?.userId || null;

    const report = await bulkImportPastPapers({ specKey, items, dryRun: !!dryRun, actorId });
    return res.status(200).json(report);
  } catch (e) {
    return res.status(400).json({ error: e.message || "Bulk import failed" });
  }
});

router.post("/past-paper-questions", auth, async (req, res) => {
  try {
    const { specKey, items, dryRun } = req.body || {};
    const actorId = req.user?._id || req.user?.id || req.user?.userId || null;

    const report = await bulkImportPastPaperQuestions({ specKey, items, dryRun: !!dryRun, actorId });
    return res.status(200).json(report);
  } catch (e) {
    return res.status(400).json({ error: e.message || "Bulk import failed" });
  }
});

module.exports = router;
