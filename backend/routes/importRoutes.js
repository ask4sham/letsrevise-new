/**
 * Phase 1: CSV import routes for Flashcards and Exam Questions.
 * Admin/teacher-protected.
 */
const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  importFlashcardsFromCsv,
  importExamQuestionsFromCsv,
} = require("../services/csvContentImportService");
const { sendInternalError } = require("../utils/safeErrorResponse");

const { FILE_STORAGE_PATH } = require("../config/paths");
const csvImportDir = path.join(FILE_STORAGE_PATH, "csv-import");
if (!fs.existsSync(csvImportDir)) fs.mkdirSync(csvImportDir, { recursive: true });

const uploadCsv = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, csvImportDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "") || ".csv";
      cb(null, `import-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname || "") || "").toLowerCase();
    if (ext === ".csv") return cb(null, true);
    cb(new Error("Only .csv files allowed"));
  },
});

function requireTeacherOrAdmin(req, res, next) {
  const t = (req.user?.userType || "").toLowerCase();
  if (t !== "teacher" && t !== "admin") {
    return res.status(403).json({ error: "Only teachers and admins can import content" });
  }
  next();
}

/** POST /api/import/flashcards/csv */
router.post("/flashcards/csv", auth, requireTeacherOrAdmin, uploadCsv.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: "CSV file is required" });
    }
    const dryRun = req.body.dryRun === "true" || req.body.dryRun === true;
    const defaultSpecKey = req.body.defaultSpecKey ? String(req.body.defaultSpecKey).trim() : undefined;
    const defaultTopicKey = req.body.defaultTopicKey ? String(req.body.defaultTopicKey).trim() : undefined;
    const importedByUserId = req.user?.userId || req.user?._id || req.user?.id || null;

    const result = await importFlashcardsFromCsv({
      filePath: req.file.path,
      dryRun,
      defaultSpecKey: defaultSpecKey || undefined,
      defaultTopicKey: defaultTopicKey || undefined,
      importedByUserId,
    });

    try { fs.unlinkSync(req.file.path); } catch (_) {}

    return res.status(200).json(result);
  } catch (e) {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    return sendInternalError("import/flashcards-csv", e, res, { extra: { error: "Import failed" } });
  }
});

/** POST /api/import/exam-questions/csv */
router.post("/exam-questions/csv", auth, requireTeacherOrAdmin, uploadCsv.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: "CSV file is required" });
    }
    const dryRun = req.body.dryRun === "true" || req.body.dryRun === true;
    const defaultSpecKey = req.body.defaultSpecKey ? String(req.body.defaultSpecKey).trim() : undefined;
    const defaultTopicKey = req.body.defaultTopicKey ? String(req.body.defaultTopicKey).trim() : undefined;
    const importedByUserId = req.user?.userId || req.user?._id || req.user?.id || null;

    const result = await importExamQuestionsFromCsv({
      filePath: req.file.path,
      dryRun,
      defaultSpecKey: defaultSpecKey || undefined,
      defaultTopicKey: defaultTopicKey || undefined,
      importedByUserId,
    });

    try { fs.unlinkSync(req.file.path); } catch (_) {}

    return res.status(200).json(result);
  } catch (e) {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    return sendInternalError("import/exam-questions-csv", e, res, { extra: { error: "Import failed" } });
  }
});

const FLASHCARD_CSV_HEADER = "front,back,specKey,topicKey,imageUrl,tags,difficulty,status";
const EXAM_QUESTION_CSV_HEADER = "questionText,markScheme,specKey,topicKey,marks,imageUrl,questionType,tags,status";

/** GET /api/import/templates/flashcards-csv */
router.get("/templates/flashcards-csv", auth, requireTeacherOrAdmin, (req, res) => {
  const example = `${FLASHCARD_CSV_HEADER}
What is mitosis?,Cell division that produces two identical daughter cells,aqa-gcse-biology,cell-division,,,,
What is diffusion?,Net movement of particles from high to low concentration,aqa-gcse-biology,diffusion,https://example.com/diagram.png,,draft`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=flashcards-template.csv");
  res.send(example);
});

/** GET /api/import/templates/exam-questions-csv */
router.get("/templates/exam-questions-csv", auth, requireTeacherOrAdmin, (req, res) => {
  const example = `${EXAM_QUESTION_CSV_HEADER}
Describe the process of mitosis,1. Chromosomes condense 2. Nuclear envelope breaks down 3. Spindle forms,aqa-gcse-biology,cell-division,4,,short,,draft`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=exam-questions-template.csv");
  res.send(example);
});

module.exports = router;
