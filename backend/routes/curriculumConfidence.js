const express = require("express");
const router = express.Router();

/**
 * GET /api/curriculum-confidence/:lessonId
 * Returns curriculum confidence payload shaped like teacher-curriculum-confidence.contract.json.
 * Placeholder implementation; no DB or auth yet.
 */
router.get("/:lessonId", (req, res) => {
  const lessonId = req.params.lessonId;
  res.status(200).json({
    lessonId,
    subject: "Biology",
    level: "GCSE",
    board: "AQA",
    specVersion: "2025",
    curriculumCoverage: {
      statutory: [
        { authority: "DfE", statementId: "DFE-BIO-KS4-4.1" }
      ],
      examBoard: [
        {
          board: "AQA",
          topic: "Photosynthesis",
          specPoint: "Interpret graphs showing limiting factors"
        }
      ]
    },
    review: {
      status: "approved",
      reviewedBy: {
        name: "Placeholder",
        role: "teacher",
        experienceYears: 0
      },
      reviewedAt: "2025-02-05T12:00:00.000Z"
    },
    provenance: {
      aiAssisted: true,
      humanApproved: true
    }
  });
});

module.exports = router;
