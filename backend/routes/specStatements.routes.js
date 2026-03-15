/**
 * PR-001: SpecStatement admin CRUD routes.
 * GET /api/spec-statements, POST, PUT /:id, DELETE /:id
 * Extended: POST /ingest, GET /:specKey
 */
const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const router = express.Router();
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const { list, create, update, remove, listBySpec, ingest } = require("../controllers/specStatements.controller");

const { FILE_STORAGE_PATH } = require("../config/paths");
const specDocsDir = path.join(FILE_STORAGE_PATH, "spec-docs");
if (!fs.existsSync(specDocsDir)) fs.mkdirSync(specDocsDir, { recursive: true });

const uploadSpecDoc = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, specDocsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "") || ".txt";
      cb(null, `ingest-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname || "") || "").toLowerCase();
    if ([".txt", ".md", ".pdf"].includes(ext)) return cb(null, true);
    cb(new Error("Only .txt, .md, .pdf allowed"));
  },
});

router.get("/", auth, requireAdmin, list);
router.get("/:specKey", auth, requireAdmin, listBySpec);
router.post("/", auth, requireAdmin, create);
router.post("/ingest", auth, requireAdmin, uploadSpecDoc.single("file"), ingest);
router.put("/:id", auth, requireAdmin, update);
router.delete("/:id", auth, requireAdmin, remove);

module.exports = router;
