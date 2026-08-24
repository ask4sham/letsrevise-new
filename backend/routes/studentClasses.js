/**
 * Teacher class + invitation APIs (Phase 1–3A).
 * Anti-enumeration: invitation create never queries User.
 */
"use strict";

const express = require("express");
const multer = require("multer");
const router = express.Router();
const auth = require("../middleware/auth");
const { createUploadLimiter, createAttemptLimiter } = require("../middleware/rateLimitBulk");
const StudentClass = require("../models/StudentClass");
const StudentClassInvitation = require("../models/StudentClassInvitation");
const {
  parseInvitationInput,
  processInvitationsForClass,
  serializeInvitationForTeacher,
  MAX_UNIQUE_VALID_EMAILS,
} = require("../services/studentClassInvitations");
const {
  listInvitationsForTeacher,
  listActiveRoster,
} = require("../services/studentClassConsent");
const { parseStudentInvitationCsv, CSV_MAX_BYTES } = require("../services/studentClassCsvPreview");
const {
  resendInvitation,
  applyClassPatch,
  archiveClass,
  teacherRemoveMembership,
} = require("../services/studentClassMembershipLifecycle");

const mutationLimiter = createAttemptLimiter();
const csvUploadLimiter = createUploadLimiter();

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CSV_MAX_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    const name = String(file.originalname || "").toLowerCase();
    if (!name.endsWith(".csv")) {
      return cb(new Error("Only .csv files are allowed"));
    }
    cb(null, true);
  },
});

function getUserId(req) {
  return req.user?.userId ?? req.user?._id ?? req.user?.id;
}

function isTeacherOrAdmin(req) {
  const t = (req.user?.userType || req.user?.type || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user?.isAdmin === true;
}

function isAdmin(req) {
  const t = (req.user?.userType || req.user?.type || "").toString().toLowerCase();
  return t === "admin" || req.user?.isAdmin === true;
}

function serializeClass(doc) {
  return {
    publicId: doc.publicId,
    name: doc.name,
    description: doc.description || "",
    status: doc.status,
    subject: doc.subject || null,
    board: doc.board || null,
    specKey: doc.specKey || null,
    tier: doc.tier || null,
    academicYear: doc.academicYear || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    archivedAt: doc.archivedAt || null,
  };
}

async function loadOwnedClass(req, classPublicId) {
  const publicId = String(classPublicId || "").trim();
  if (!publicId) return { error: { status: 404, body: { error: "Class not found" } } };

  const cls = await StudentClass.findOne({ publicId }).lean();
  if (!cls) return { error: { status: 404, body: { error: "Class not found" } } };

  const me = String(getUserId(req));
  if (!isAdmin(req) && String(cls.teacherId) !== me) {
    // Conceal existence from non-owners
    return { error: { status: 404, body: { error: "Class not found" } } };
  }
  return { cls };
}

// POST /api/student-classes
router.post("/", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const teacherId = getUserId(req);
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });

    // Never trust client teacherId
    const name = req.body && typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "name is required" });
    if (name.length > StudentClass.NAME_MAX) {
      return res.status(400).json({ error: `name must be at most ${StudentClass.NAME_MAX} characters` });
    }

    let description = "";
    if (req.body && req.body.description != null) {
      description = String(req.body.description).trim();
      if (description.length > StudentClass.DESCRIPTION_MAX) {
        return res.status(400).json({
          error: `description must be at most ${StudentClass.DESCRIPTION_MAX} characters`,
        });
      }
    }

    const optional = {};
    for (const key of ["subject", "board", "specKey", "tier", "academicYear"]) {
      if (req.body && req.body[key] != null && String(req.body[key]).trim()) {
        optional[key] = String(req.body[key]).trim();
      }
    }

    const created = await StudentClass.create({
      teacherId,
      name,
      description,
      ...optional,
      status: "active",
    });

    return res.status(201).json({ ok: true, class: serializeClass(created) });
  } catch (err) {
    console.error("[student-classes] create error:", err);
    return res.status(500).json({ error: "Failed to create class" });
  }
});

// GET /api/student-classes/mine
router.get("/mine", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const teacherId = getUserId(req);
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });

    const rows = await StudentClass.find({ teacherId }).sort({ createdAt: -1 }).lean();
    return res.json({
      ok: true,
      classes: rows.map(serializeClass),
    });
  } catch (err) {
    console.error("[student-classes] list mine error:", err);
    return res.status(500).json({ error: "Failed to list classes" });
  }
});

// GET /api/student-classes/:classPublicId
router.get("/:classPublicId", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const loaded = await loadOwnedClass(req, req.params.classPublicId);
    if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);
    return res.json({ ok: true, class: serializeClass(loaded.cls) });
  } catch (err) {
    console.error("[student-classes] get error:", err);
    return res.status(500).json({ error: "Failed to load class" });
  }
});

// PATCH /api/student-classes/:classPublicId
router.patch("/:classPublicId", auth, mutationLimiter, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const loaded = await loadOwnedClass(req, req.params.classPublicId);
    if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);

    const cls = await StudentClass.findById(loaded.cls._id);
    if (!cls) return res.status(404).json({ error: "Class not found" });

    const validation = applyClassPatch(cls, req.body || {});
    if (validation && validation.error) {
      return res.status(validation.error.status).json(validation.error.body);
    }

    await cls.save();
    return res.json({ ok: true, class: serializeClass(cls) });
  } catch (err) {
    console.error("[student-classes] patch error:", err);
    return res.status(500).json({ error: "Failed to update class" });
  }
});

// POST /api/student-classes/:classPublicId/archive
router.post("/:classPublicId/archive", auth, mutationLimiter, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const loaded = await loadOwnedClass(req, req.params.classPublicId);
    if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);

    const archived = await archiveClass(loaded.cls);
    return res.json({
      ok: true,
      class: {
        publicId: archived.publicId,
        name: archived.name,
        status: "archived",
        archivedAt: archived.archivedAt,
      },
    });
  } catch (err) {
    console.error("[student-classes] archive error:", err);
    return res.status(500).json({ error: "Failed to archive class" });
  }
});

// POST /api/student-classes/:classPublicId/invitations/csv/preview
router.post(
  "/:classPublicId/invitations/csv/preview",
  auth,
  csvUploadLimiter,
  (req, res, next) => {
    uploadCsv.single("file")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ error: "File exceeds 5 MB limit", code: "FILE_TOO_LARGE" });
          }
          return res.status(400).json({ error: err.message || "Upload failed", code: "UPLOAD_ERROR" });
        }
        return res.status(400).json({
          error: err.message || "Only .csv files are allowed",
          code: "INVALID_FILE_TYPE",
        });
      }
      return next();
    });
  },
  async (req, res) => {
    try {
      if (!isTeacherOrAdmin(req)) {
        return res.status(403).json({ error: "Teachers and admins only" });
      }
      const loaded = await loadOwnedClass(req, req.params.classPublicId);
      if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: "File is required", code: "FILE_REQUIRED" });
      }

      const parsed = parseStudentInvitationCsv(req.file.buffer);
      if (!parsed.ok) {
        return res.status(400).json({
          error: parsed.error,
          code: parsed.code,
          ...(parsed.maxUnique != null ? { maxUnique: parsed.maxUnique } : {}),
        });
      }

      return res.json({
        ok: true,
        summary: parsed.summary,
        validEmails: parsed.validEmails,
        duplicateEntries: parsed.duplicateEntries,
        invalidEntries: parsed.invalidEntries,
      });
    } catch (err) {
      console.error("[student-classes] csv preview error:", err);
      return res.status(500).json({ error: "Failed to preview CSV" });
    }
  }
);

// POST /api/student-classes/:classPublicId/invitations/preview
router.post("/:classPublicId/invitations/preview", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const loaded = await loadOwnedClass(req, req.params.classPublicId);
    if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);

    const parsed = parseInvitationInput(req.body || {});
    if (!parsed.ok && parsed.code === "EMAIL_LIMIT_EXCEEDED") {
      return res.status(400).json({
        error: parsed.error,
        code: parsed.code,
        maxUnique: MAX_UNIQUE_VALID_EMAILS,
      });
    }
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error || "Invalid input" });
    }

    return res.json({
      ok: true,
      summary: {
        totalSubmitted: parsed.totalSubmitted,
        validCount: parsed.validEmails.length,
        duplicateCount: parsed.duplicateEntries.length,
        invalidCount: parsed.invalidEntries.length,
      },
      validEmails: parsed.validEmails,
      duplicateEntries: parsed.duplicateEntries,
      invalidEntries: parsed.invalidEntries,
    });
  } catch (err) {
    console.error("[student-classes] invitation preview error:", err);
    return res.status(500).json({ error: "Failed to preview invitations" });
  }
});

// POST /api/student-classes/:classPublicId/invitations
router.post("/:classPublicId/invitations", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const teacherId = getUserId(req);
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });

    const loaded = await loadOwnedClass(req, req.params.classPublicId);
    if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);
    const cls = loaded.cls;

    if (cls.status === "archived") {
      return res.status(400).json({ error: "Archived classes cannot accept new invitations" });
    }

    const parsed = parseInvitationInput(req.body || {});
    if (!parsed.ok && parsed.code === "EMAIL_LIMIT_EXCEEDED") {
      return res.status(400).json({
        error: parsed.error,
        code: parsed.code,
        maxUnique: MAX_UNIQUE_VALID_EMAILS,
      });
    }
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error || "Invalid input" });
    }
    if (!parsed.validEmails.length) {
      return res.status(400).json({ error: "At least one valid email is required" });
    }

    // No User lookup — anti-enumeration
    await processInvitationsForClass({
      classDoc: cls,
      teacherId: cls.teacherId,
      validEmails: parsed.validEmails,
    });

    return res.json({
      ok: true,
      message: "Invitations processed.",
      summary: {
        submitted: parsed.totalSubmitted,
        invalid: parsed.invalidEntries.length,
        duplicates: parsed.duplicateEntries.length,
      },
    });
  } catch (err) {
    console.error("[student-classes] invitation create error:", err);
    return res.status(500).json({ error: "Failed to process invitations" });
  }
});

// GET /api/student-classes/:classPublicId/students — active roster (post-accept names only)
router.get("/:classPublicId/students", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const loaded = await loadOwnedClass(req, req.params.classPublicId);
    if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);

    const { students } = await listActiveRoster(loaded.cls);
    return res.json({ ok: true, students });
  } catch (err) {
    console.error("[student-classes] roster error:", err);
    return res.status(500).json({ error: "Failed to list students" });
  }
});

// GET /api/student-classes/:classPublicId/invitations
router.get("/:classPublicId/invitations", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const loaded = await loadOwnedClass(req, req.params.classPublicId);
    if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);

    const invitations = await listInvitationsForTeacher(loaded.cls._id);
    return res.json({
      ok: true,
      invitations,
    });
  } catch (err) {
    console.error("[student-classes] invitation list error:", err);
    return res.status(500).json({ error: "Failed to list invitations" });
  }
});

// DELETE /api/student-classes/:classPublicId/students/:membershipPublicId
router.delete(
  "/:classPublicId/students/:membershipPublicId",
  auth,
  mutationLimiter,
  async (req, res) => {
    try {
      if (!isTeacherOrAdmin(req)) {
        return res.status(403).json({ error: "Teachers and admins only" });
      }
      const loaded = await loadOwnedClass(req, req.params.classPublicId);
      if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);

      const outcome = await teacherRemoveMembership({
        classDoc: loaded.cls,
        membershipPublicId: req.params.membershipPublicId,
      });
      if (outcome.error) {
        return res.status(outcome.error.status).json(outcome.error.body);
      }
      return res.json(outcome.result);
    } catch (err) {
      console.error("[student-classes] remove student error:", err);
      return res.status(500).json({ error: "Failed to remove student" });
    }
  }
);

// POST /api/student-classes/:classPublicId/invitations/:invitationPublicId/resend
router.post(
  "/:classPublicId/invitations/:invitationPublicId/resend",
  auth,
  mutationLimiter,
  async (req, res) => {
    try {
      if (!isTeacherOrAdmin(req)) {
        return res.status(403).json({ error: "Teachers and admins only" });
      }
      const loaded = await loadOwnedClass(req, req.params.classPublicId);
      if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);

      const outcome = await resendInvitation({
        classDoc: loaded.cls,
        invitationPublicId: req.params.invitationPublicId,
      });
      if (outcome.error) {
        return res.status(outcome.error.status).json(outcome.error.body);
      }
      return res.json(outcome.result);
    } catch (err) {
      console.error("[student-classes] resend error:", err);
      return res.status(500).json({ error: "Failed to resend invitation" });
    }
  }
);

// POST /api/student-classes/:classPublicId/invitations/:invitationPublicId/cancel
router.post("/:classPublicId/invitations/:invitationPublicId/cancel", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const loaded = await loadOwnedClass(req, req.params.classPublicId);
    if (loaded.error) return res.status(loaded.error.status).json(loaded.error.body);

    const invitationPublicId = String(req.params.invitationPublicId || "").trim();
    if (!invitationPublicId) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    const inv = await StudentClassInvitation.findOne({
      publicId: invitationPublicId,
      classId: loaded.cls._id,
    });
    if (!inv) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    const effective = StudentClassInvitation.effectiveStatus(inv);
    if (effective === "accepted") {
      return res.status(400).json({ error: "Accepted invitations cannot be cancelled" });
    }
    if (effective === "cancelled") {
      return res.json({
        ok: true,
        invitation: serializeInvitationForTeacher(inv.toObject ? inv.toObject() : inv),
      });
    }

    if (inv.status === "pending" || effective === "expired") {
      inv.status = "cancelled";
      inv.cancelledAt = new Date();
      await inv.save();
    } else if (inv.status === "declined" || inv.status === "expired") {
      // Explicit cancel of non-pending states: mark cancelled for roster clarity
      inv.status = "cancelled";
      inv.cancelledAt = inv.cancelledAt || new Date();
      await inv.save();
    }

    return res.json({
      ok: true,
      invitation: serializeInvitationForTeacher(inv.toObject ? inv.toObject() : inv),
    });
  } catch (err) {
    console.error("[student-classes] invitation cancel error:", err);
    return res.status(500).json({ error: "Failed to cancel invitation" });
  }
});

module.exports = router;
