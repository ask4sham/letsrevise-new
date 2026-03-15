/**
 * PR-001: SpecStatement CRUD controller — admin-only.
 * Extended: ingest endpoint for spec document ingestion.
 */
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const SpecStatement = require("../models/SpecStatement");
const { ingestSpecDocument } = require("../services/specDocumentIngestionService");
const { FILE_STORAGE_PATH } = require("../config/paths");

/**
 * GET list — filter by specKey, topicKey, examBoard, level
 */
async function list(req, res) {
  try {
    const { specKey, topicKey, examBoard, level } = req.query;
    const query = {};
    if (specKey && String(specKey).trim()) query.specKey = String(specKey).trim();
    if (topicKey && String(topicKey).trim()) query.topicKey = String(topicKey).trim();
    if (examBoard && String(examBoard).trim()) query.examBoard = String(examBoard).trim();
    if (level && String(level).trim()) query.level = String(level).trim();

    const items = await SpecStatement.find(query).sort({ specKey: 1, statementCode: 1 }).lean();
    return res.json({ items });
  } catch (err) {
    console.error("SpecStatements list error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
 * POST create — create new statement
 */
async function create(req, res) {
  try {
    const { specKey, examBoard, level, topicKey, statementCode, statementText, tier, tags, metadata } = req.body;
    if (!specKey || !examBoard || !level || !topicKey || !statementCode || !statementText) {
      return res.status(400).json({
        error: "specKey, examBoard, level, topicKey, statementCode, and statementText are required",
      });
    }
    const doc = await SpecStatement.create({
      specKey: String(specKey).trim(),
      examBoard: String(examBoard).trim(),
      level: String(level).trim(),
      topicKey: String(topicKey).trim(),
      statementCode: String(statementCode).trim(),
      statementText: String(statementText).trim(),
      tier: tier != null ? String(tier).trim() || null : null,
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    });
    return res.status(201).json({ statement: doc.toObject() });
  } catch (err) {
    console.error("SpecStatements create error:", err);
    return res.status(400).json({ error: err.message || "Bad request" });
  }
}

/**
 * PUT update — update statement by id
 */
async function update(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const doc = await SpecStatement.findById(id);
    if (!doc) return res.status(404).json({ error: "SpecStatement not found" });

    const allowed = ["specKey", "examBoard", "level", "topicKey", "statementCode", "statementText", "tier", "tags", "metadata"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === "tags") {
          doc.tags = Array.isArray(req.body.tags) ? req.body.tags.map((t) => String(t).trim()).filter(Boolean) : [];
        } else if (key === "metadata") {
          doc.metadata = req.body.metadata && typeof req.body.metadata === "object" ? req.body.metadata : doc.metadata;
        } else {
          doc[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
        }
      }
    }
    await doc.save();
    return res.json({ statement: doc.toObject() });
  } catch (err) {
    console.error("SpecStatements update error:", err);
    return res.status(400).json({ error: err.message || "Bad request" });
  }
}

/**
 * DELETE — delete statement by id
 */
async function remove(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const result = await SpecStatement.deleteOne({ _id: id });
    if (result.deletedCount === 0) return res.status(404).json({ error: "SpecStatement not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("SpecStatements delete error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
 * GET by specKey — returns stored SpecStatements for a spec
 */
async function listBySpec(req, res) {
  try {
    const { specKey } = req.params;
    if (!specKey || !String(specKey).trim()) {
      return res.status(400).json({ error: "specKey is required" });
    }
    const items = await SpecStatement.find({ specKey: String(specKey).trim() })
      .sort({ topicKey: 1, statementCode: 1 })
      .lean();
    return res.json({ items });
  } catch (err) {
    console.error("SpecStatements listBySpec error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
 * POST ingest — ingest spec document (file upload or filePath)
 * Body (multipart): file, specKey, subject?, dryRun?
 * Body (JSON): filePath, specKey, subject?, dryRun?
 */
async function ingest(req, res) {
  try {
    const specKey = req.body?.specKey || req.body.specKey;
    const subject = req.body?.subject || req.body.subject;
    const dryRun = req.body?.dryRun === true || req.body?.dryRun === "true";

    if (!specKey || !String(specKey).trim()) {
      return res.status(400).json({ error: "specKey is required" });
    }

    let filePath = req.body?.filePath || req.body.filePath;

    if (req.file) {
      filePath = req.file.path ? (path.isAbsolute(req.file.path) ? req.file.path : path.resolve(req.file.path)) : null;
      if (!filePath && req.file.buffer) {
        const uploadsDir = path.join(FILE_STORAGE_PATH, "spec-docs");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const ext = path.extname(req.file.originalname || "") || ".txt";
        const absPath = path.join(uploadsDir, `ingest-${Date.now()}${ext}`);
        fs.writeFileSync(absPath, req.file.buffer);
        filePath = absPath;
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({
        error: "filePath is required and must exist, or upload a file (multipart field: file)",
      });
    }

    const result = await ingestSpecDocument({
      filePath,
      specKey: String(specKey).trim(),
      subject: subject ? String(subject).trim() : undefined,
      dryRun,
    });

    return res.json(result);
  } catch (err) {
    console.error("SpecStatements ingest error:", err);
    return res.status(500).json({ error: err.message || "Ingestion failed" });
  }
}

module.exports = { list, create, update, remove, listBySpec, ingest };
