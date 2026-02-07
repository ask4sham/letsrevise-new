const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const STATUTORY_PATH = path.join(process.cwd(), "docs", "curriculum", "statutory", "england-gcse-biology.v1.json");
const BOARD_SPEC_PATH = path.join(process.cwd(), "docs", "curriculum", "boards", "aqa-gcse-biology-photosynthesis.v1.json");

/**
 * GET /api/curriculum-confidence/:lessonId
 * Returns curriculum confidence payload shaped like teacher-curriculum-confidence.contract.json.
 * Derives curriculumCoverage from statutory + board spec files; review + provenance hardcoded.
 */
router.get("/:lessonId", (req, res) => {
  const lessonId = req.params.lessonId;

  let statutoryData;
  let boardSpec;
  try {
    statutoryData = JSON.parse(fs.readFileSync(STATUTORY_PATH, "utf8"));
    boardSpec = JSON.parse(fs.readFileSync(BOARD_SPEC_PATH, "utf8"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to load curriculum data" });
  }

  const mapsToDfE = boardSpec.mapsToDfE || [];
  const examRequirements = boardSpec.examRequirements || [];
  const authority = statutoryData.authority || "DfE";

  const curriculumCoverage = {
    statutory: mapsToDfE.map((statementId) => ({ authority, statementId })),
    examBoard: examRequirements.map((specPoint) => ({
      board: boardSpec.board,
      topic: boardSpec.topic,
      specPoint
    }))
  };

  res.status(200).json({
    lessonId,
    subject: boardSpec.subject,
    level: boardSpec.level,
    board: boardSpec.board,
    specVersion: boardSpec.specVersion,
    topic: boardSpec.topic,
    curriculumCoverage,
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
