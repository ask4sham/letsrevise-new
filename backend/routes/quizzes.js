// backend/routes/quizzes.js

const express = require("express");
const router = express.Router();

console.log("✅ quizzes router file loaded");

const { supabase } = require("../supabaseClient");
const auth = require("../middleware/auth"); // ✅ use JWT auth for attempt saving

// ----------------- DEBUG TEST ROUTE (no auth) -----------------
router.get("/test", (req, res) => {
  console.log("✅ HIT /api/quizzes/test");
  res.json({ ok: true, message: "Quizzes router is mounted and responding" });
});

// ----------------- Helper: validate quiz payload -----------------
function validateQuizPayload(body) {
  const errors = [];

  if (!body.title || typeof body.title !== "string") {
    errors.push("title is required and must be a string");
  }
  if (!body.level || typeof body.level !== "string") {
    errors.push("level is required and must be a string");
  }
  if (!body.subject || typeof body.subject !== "string") {
    errors.push("subject is required and must be a string");
  }
  if (!body.exam_board || typeof body.exam_board !== "string") {
    errors.push("exam_board is required and must be a string");
  }
  if (!body.module || typeof body.module !== "string") {
    errors.push("module is required and must be a string");
  }

  if (!Array.isArray(body.questions)) {
    errors.push("questions must be an array");
  } else {
    body.questions.forEach((q, index) => {
      if (!q || typeof q !== "object") {
        errors.push(`questions[${index}] must be an object`);
        return;
      }

      if (!q.questionText || typeof q.questionText !== "string") {
        errors.push(
          `questions[${index}].questionText is required and must be a string`
        );
      }

      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(
          `questions[${index}].options must be an array with at least 2 options`
        );
      }

      if (
        typeof q.correctIndex !== "number" ||
        q.correctIndex < 0 ||
        !q.options ||
        q.correctIndex >= q.options.length
      ) {
        errors.push(
          `questions[${index}].correctIndex must be a valid index into the options array`
        );
      }

      if (q.explanation && typeof q.explanation !== "string") {
        errors.push(
          `questions[${index}].explanation must be a string if provided`
        );
      }
    });
  }

  return errors;
}

// ----------------- GET /api/quizzes -----------------
router.get("/", async (req, res) => {
  try {
    console.log("➡️ GET /api/quizzes hit");

    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Supabase not configured on server" });
    }

    const { level, subject, exam_board, module, is_published } = req.query;

    let query = supabase.from("quizzes").select("*");

    if (level) query = query.eq("level", level);
    if (subject) query = query.eq("subject", subject);
    if (exam_board) query = query.eq("exam_board", exam_board);
    if (module) query = query.eq("module", module);

    if (typeof is_published !== "undefined") {
      query = query.eq("is_published", is_published === "true");
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching quizzes:", error);
      return res.status(500).json({ error: "Failed to fetch quizzes" });
    }

    res.json({ quizzes: data || [] });
  } catch (err) {
    console.error("Unexpected error in GET /api/quizzes:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ----------------- GET /api/quizzes/stats/all -----------------
router.get("/stats/all", async (req, res) => {
  try {
    console.log("➡️ GET /api/quizzes/stats/all hit");

    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Supabase not configured on server" });
    }

    const { data: attempts, error } = await supabase
      .from("quiz_attempts")
      .select("*");

    if (error) {
      console.error("Error fetching quiz_attempts:", error);
      return res.status(500).json({ error: "Failed to fetch quiz stats" });
    }

    if (!attempts || attempts.length === 0) {
      return res.json({ stats: [] });
    }

    const statsByQuiz = {};
    for (const a of attempts) {
      const quizId = a.quiz_id;
      if (!quizId) continue;

      if (!statsByQuiz[quizId]) {
        statsByQuiz[quizId] = {
          quiz_id: quizId,
          attempts: 0,
          totalCorrect: 0,
          totalQuestions: 0,
        };
      }

      statsByQuiz[quizId].attempts += 1;
      statsByQuiz[quizId].totalCorrect += a.correct_answers || 0;
      statsByQuiz[quizId].totalQuestions += a.total_questions || 0;
    }

    const quizIds = Object.keys(statsByQuiz);
    let quizzesData = [];
    if (quizIds.length > 0) {
      const { data: quizzes, error: quizError } = await supabase
        .from("quizzes")
        .select("id, title")
        .in("id", quizIds);

      if (quizError) {
        console.error("Error fetching quizzes for stats:", quizError);
      } else {
        quizzesData = quizzes || [];
      }
    }

    const titleById = {};
    for (const q of quizzesData) {
      titleById[q.id] = q.title || "Untitled quiz";
    }

    const result = Object.values(statsByQuiz).map((s) => {
      const stats = s;
      const avg =
        stats.totalQuestions > 0
          ? stats.totalCorrect / stats.totalQuestions
          : 0;
      return {
        quiz_id: stats.quiz_id,
        title: titleById[stats.quiz_id] || "Untitled quiz",
        attempts: stats.attempts,
        average_score: avg, // 0–1 ratio
      };
    });

    res.json({ stats: result });
  } catch (err) {
    console.error("Unexpected error in GET /api/quizzes/stats/all:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ----------------- GET /api/quizzes/attempts -----------------
router.get("/attempts", async (req, res) => {
  try {
    console.log("➡️ GET /api/quizzes/attempts hit");

    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Supabase not configured on server" });
    }

    const rawUserId = req.query.user_id;
    const userId = rawUserId ? String(rawUserId).trim() : "";

    if (!userId) {
      return res.status(400).json({
        error: "user_id query parameter is required",
      });
    }

    const { data: attempts, error } = await supabase
      .from("quiz_attempts")
      .select("id, quiz_id, total_questions, correct_answers, created_at, user_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching quiz_attempts for user:", error);
      return res.status(500).json({ error: "Failed to fetch quiz attempts" });
    }

    if (!attempts || attempts.length === 0) {
      return res.json({ attempts: [] });
    }

    const quizIds = [...new Set(attempts.map((a) => a.quiz_id).filter(Boolean))];

    let quizzesData = [];
    if (quizIds.length > 0) {
      const { data: quizzes, error: quizError } = await supabase
        .from("quizzes")
        .select("id, title")
        .in("id", quizIds);

      if (quizError) {
        console.error("Error fetching quizzes for attempts:", quizError);
      } else {
        quizzesData = quizzes || [];
      }
    }

    const titleById = {};
    for (const q of quizzesData) {
      titleById[q.id] = q.title || "Untitled quiz";
    }

    const result = attempts.map((a) => {
      const totalQ = a.total_questions || 0;
      const correct = a.correct_answers || 0;
      const score = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;

      return {
        id: a.id,
        quiz_id: a.quiz_id,
        quiz_title: titleById[a.quiz_id] || "Untitled quiz",
        total_questions: totalQ,
        correct_answers: correct,
        score_percent: score,
        created_at: a.created_at,
        user_id: a.user_id,
      };
    });

    res.json({ attempts: result });
  } catch (err) {
    console.error("Unexpected error in GET /api/quizzes/attempts:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ----------------- GET /api/quizzes/:id -----------------
router.get("/:id", async (req, res) => {
  try {
    const rawId = req.params.id;
    console.log("➡️ GET /api/quizzes/:id hit. Raw id:", rawId);

    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Supabase not configured on server" });
    }

    const id = String(rawId).trim();

    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code === "PGRST116") {
      return res.status(404).json({ error: "Quiz not found" });
    }

    if (error) {
      console.error("Error fetching quiz by id:", error);
      return res.status(500).json({ error: "Failed to fetch quiz" });
    }

    res.json({ quiz: data });
  } catch (err) {
    console.error("Unexpected error in GET /api/quizzes/:id:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ----------------- POST /api/quizzes -----------------
// NOTE: This route uses req.user but currently isn't protected by auth.
// We'll leave as-is for now to avoid breaking flows.
router.post("/", async (req, res) => {
  try {
    console.log("➡️ POST /api/quizzes hit");

    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Supabase not configured on server" });
    }

    const {
      title,
      description,
      level,
      subject,
      exam_board,
      module,
      questions,
      is_published,
    } = req.body;

    const validationErrors = validateQuizPayload({
      title,
      description,
      level,
      subject,
      exam_board,
      module,
      questions,
    });

    if (validationErrors.length > 0) {
      return res
        .status(400)
        .json({ error: "Invalid payload", details: validationErrors });
    }

    const teacherId = req.user?.mongoId || req.user?._id || req.user?.id;

    const { data, error } = await supabase
      .from("quizzes")
      .insert([
        {
          teacher_id: String(teacherId || ""),
          title,
          description: description || null,
          level,
          subject,
          exam_board,
          module,
          questions,
          is_published: !!is_published,
        },
      ])
      .select("*")
      .single();

    if (error) {
      console.error("Error creating quiz:", error);
      return res.status(500).json({ error: "Failed to create quiz" });
    }

    res.status(201).json({ quiz: data });
  } catch (err) {
    console.error("Unexpected error in POST /api/quizzes:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ----------------- POST /api/quizzes/:id/attempt -----------------
// ✅ NOW PROTECTED: user_id is derived from JWT, not from client payload
router.post("/:id/attempt", auth, async (req, res) => {
  try {
    const rawId = req.params.id;
    console.log("➡️ POST /api/quizzes/:id/attempt hit. Raw id:", rawId);

    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Supabase not configured on server" });
    }

    const id = String(rawId).trim();
    const { total_questions, correct_answers } = req.body || {};

    if (
      typeof total_questions !== "number" ||
      total_questions <= 0 ||
      typeof correct_answers !== "number" ||
      correct_answers < 0 ||
      correct_answers > total_questions
    ) {
      return res.status(400).json({
        error: "Invalid attempt payload",
        details:
          "total_questions must be > 0 and correct_answers between 0 and total_questions",
      });
    }

    // ✅ Use Mongo user id from JWT (this matches Parent linking childId)
    const userIdFromJwt = req.user?.userId || req.user?._id || req.user?.id;

    if (!userIdFromJwt) {
      return res.status(401).json({ error: "Unauthorised: user not found in token" });
    }

    const finalUserId = String(userIdFromJwt);

    const { data, error } = await supabase
      .from("quiz_attempts")
      .insert([
        {
          quiz_id: id,
          user_id: finalUserId, // ✅ never null now
          total_questions,
          correct_answers,
        },
      ])
      .select("*")
      .single();

    if (error) {
      console.error("Error creating quiz attempt:", error);
      return res.status(500).json({ error: "Failed to save quiz attempt" });
    }

    res.status(201).json({ attempt: data });
  } catch (err) {
    console.error("Unexpected error in POST /api/quizzes/:id/attempt:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
