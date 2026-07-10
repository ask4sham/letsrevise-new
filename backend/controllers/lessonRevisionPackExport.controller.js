/**
 * Lesson Revision Pack PDF V1 — export controller.
 * Full lesson access required (FREE_PREVIEW / NOT_ENTITLED denied by requireLessonAccess).
 */
const {
  renderLessonRevisionPackPdf,
  slugify,
} = require("../services/pdf/lessonRevisionPackPdf");

function isTeacherOrAdmin(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user?.isAdmin === true;
}

/**
 * POST /api/lessons/:lessonId/export/revision-pack
 * Body: { includeAnswers?: boolean } — answers only for teacher/admin.
 */
async function postLessonRevisionPackExport(req, res) {
  try {
    const lesson = req.lesson;
    if (!lesson) {
      return res.status(404).json({ error: "LESSON_NOT_FOUND" });
    }

    const decision = req.accessDecision;
    if (!decision || decision.allowed !== true) {
      // Belt-and-braces: middleware should already have denied FREE_PREVIEW / NOT_ENTITLED.
      if (decision?.reason === "NOT_ENTITLED") {
        return res.status(402).json({
          error: "Subscription required",
          reason: "NOT_ENTITLED",
          message: "Full lesson access is required to download the revision pack.",
        });
      }
      return res.status(403).json({
        error: "FORBIDDEN",
        reason: decision?.reason || "FORBIDDEN",
        message: "Full lesson access is required to download the revision pack.",
      });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const wantAnswers = body.includeAnswers === true;
    const includeAnswers = wantAnswers && isTeacherOrAdmin(req);

    let buffer;
    try {
      buffer = await renderLessonRevisionPackPdf(lesson, { includeAnswers });
    } catch (pdfErr) {
      if (pdfErr.status === 400 || pdfErr.code === "MISSING_CONTENT") {
        return res.status(400).json({
          error: "Missing content",
          message: pdfErr.message || "Lesson has no content to export.",
        });
      }
      if (process.env.NODE_ENV !== "production") {
        console.error("[lessonRevisionPackExport] render error", pdfErr);
      }
      return res.status(500).json({ error: "PDF render failed" });
    }

    const slug = slugify(lesson.title || "lesson");
    const filename = `revision-pack-${slug}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Revision-Pack-Answers", includeAnswers ? "1" : "0");
    return res.send(buffer);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[lessonRevisionPackExport] error", err);
    }
    return res.status(500).json({ error: "PDF render failed" });
  }
}

module.exports = { postLessonRevisionPackExport };
