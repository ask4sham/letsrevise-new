/**
 * PR-001: SpecStatement admin CRUD routes.
 * GET /api/spec-statements, POST, PUT /:id, DELETE /:id
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const { list, create, update, remove } = require("../controllers/specStatements.controller");

router.get("/", auth, requireAdmin, list);
router.post("/", auth, requireAdmin, create);
router.put("/:id", auth, requireAdmin, update);
router.delete("/:id", auth, requireAdmin, remove);

module.exports = router;
