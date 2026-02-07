// backend/services/validateRevision.js

/**
 * ✅ Validates and normalizes revision content (flashcards + quiz)
 * Used for manual entry OR AI-generated content
 * Ensures canonical shape for frontend + future AI parity
 */

function validateFlashcards(rawFlashcards) {
  if (!Array.isArray(rawFlashcards)) {
    throw new Error("flashcards must be an array");
  }

  return rawFlashcards.map((fc, idx) => {
    // Ensure id exists, generate if missing
    let id = fc.id;
    if (!id || typeof id !== "string" || id.trim() === "") {
      id = `fc_${Date.now()}_${idx}`;
    }

    // Validate required fields
    if (!fc.front || typeof fc.front !== "string" || fc.front.trim() === "") {
      throw new Error(`Flashcard ${idx}: front is required and must be non-empty`);
    }

    if (!fc.back || typeof fc.back !== "string" || fc.back.trim() === "") {
      throw new Error(`Flashcard ${idx}: back is required and must be non-empty`);
    }

    // Normalize optional fields
    const tags = Array.isArray(fc.tags) 
      ? fc.tags.filter(t => typeof t === "string" && t.trim() !== "").map(t => t.trim())
      : [];

    let difficulty = parseInt(fc.difficulty, 10);
    if (isNaN(difficulty) || difficulty < 1 || difficulty > 3) {
      difficulty = 1;
    }

    return {
      id: id.trim(),
      front: fc.front.trim(),
      back: fc.back.trim(),
      tags,
      difficulty
    };
  });
}

function validateQuiz(rawQuiz) {
  if (!rawQuiz || typeof rawQuiz !== "object") {
    throw new Error("quiz must be an object");
  }

  const normalized = {};

  // Validate timeSeconds
  let timeSeconds = parseInt(rawQuiz.timeSeconds, 10);
  if (isNaN(timeSeconds) || timeSeconds < 60) {
    timeSeconds = 600; // 10 minutes default
  }
  normalized.timeSeconds = timeSeconds;

  // Validate questions array
  if (!Array.isArray(rawQuiz.questions)) {
    throw new Error("quiz.questions must be an array");
  }

  normalized.questions = rawQuiz.questions.map((q, idx) => {
    // Ensure id exists, generate if missing
    let id = q.id;
    if (!id || typeof id !== "string" || id.trim() === "") {
      id = `q_${Date.now()}_${idx}`;
    }

    // Validate question type
    const validTypes = ["mcq", "short", "exam"];
    let type = q.type;
    if (!type || !validTypes.includes(type)) {
      type = "mcq"; // default to MCQ
    }

    // Validate question text
    if (!q.question || typeof q.question !== "string" || q.question.trim() === "") {
      throw new Error(`Question ${idx}: question text is required`);
    }

    // Normalize MCQ options
    let options = undefined;
    if (type === "mcq") {
      if (Array.isArray(q.options) && q.options.length > 0) {
        options = q.options
          .filter(opt => typeof opt === "string" && opt.trim() !== "")
          .map(opt => opt.trim());
        
        if (options.length < 2) {
          throw new Error(`Question ${idx}: MCQ questions need at least 2 options`);
        }
      } else {
        // If MCQ but no options provided, create dummy options
        options = ["Option A", "Option B", "Option C", "Option D"];
      }
    }

    // Normalize markScheme for exam type
    let markScheme = undefined;
    if (type === "exam" && Array.isArray(q.markScheme)) {
      markScheme = q.markScheme
        .filter(ms => typeof ms === "string" && ms.trim() !== "")
        .map(ms => ms.trim());
    }

    // Normalize correctAnswer
    let correctAnswer = q.correctAnswer || "";
    if (typeof correctAnswer !== "string") {
      correctAnswer = String(correctAnswer);
    }
    correctAnswer = correctAnswer.trim();

    // Validate that MCQ questions have correctAnswer in options
    if (type === "mcq" && correctAnswer && options) {
      if (!options.includes(correctAnswer)) {
        // If correctAnswer not in options, add it as first option
        options = [correctAnswer, ...options.filter(opt => opt !== correctAnswer)];
      }
    }

    // Normalize other fields
    let explanation = q.explanation || "";
    if (typeof explanation !== "string") {
      explanation = String(explanation);
    }
    explanation = explanation.trim();

    const tags = Array.isArray(q.tags) 
      ? q.tags.filter(t => typeof t === "string" && t.trim() !== "").map(t => t.trim())
      : [];

    let difficulty = parseInt(q.difficulty, 10);
    if (isNaN(difficulty) || difficulty < 1 || difficulty > 3) {
      difficulty = 1;
    }

    let marks = parseInt(q.marks, 10);
    if (isNaN(marks) || marks < 0) {
      marks = 1;
    }

    return {
      id: id.trim(),
      type,
      question: q.question.trim(),
      options,
      correctAnswer,
      markScheme,
      explanation,
      tags,
      difficulty,
      marks
    };
  });

  return normalized;
}

/**
 * Main validation function
 */
export function validateAndNormalizeRevision(payload) {
  const result = {};

  // Validate flashcards (optional)
  if (payload.flashcards !== undefined) {
    result.flashcards = validateFlashcards(payload.flashcards);
  }

  // Validate quiz (optional)
  if (payload.quiz !== undefined) {
    result.quiz = validateQuiz(payload.quiz);
  }

  // At least one must be provided
  if (!result.flashcards && !result.quiz) {
    throw new Error("Must provide either flashcards or quiz (or both)");
  }

  return result;
}