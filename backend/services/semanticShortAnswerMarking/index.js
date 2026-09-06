const crypto = require("crypto");
const { isBlock28SemanticMarkingEnabled } = require("../../config/block28SemanticMarking");
const { MARKING_UNAVAILABLE_MESSAGE, MARKING_SYSTEM_PROMPT } = require("./constants");
const {
  buildMarkingUserPrompt,
  buildCorrectiveUserPrompt,
} = require("./prompt");
const { callSemanticMarkingLlm } = require("./llm");
const { validateSemanticLlmPoints, deriveMarkingResult } = require("./validate");
const { resolvePracticeQuestionForMarking } = require("./resolvePracticeQuestion");

function rubricFingerprint(markScheme, question, marks) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ markScheme, question, marks }))
    .digest("hex");
}

function deriveLessonSpecKey(lesson) {
  const topicKey = lesson?.topicKey ? String(lesson.topicKey) : "";
  const idx = topicKey.indexOf(":");
  return idx > 0 ? topicKey.slice(0, idx) : "";
}

/**
 * @param {{
 *   lesson: object,
 *   questionId: string,
 *   studentAnswer: string,
 *   attachmentRefId?: string,
 *   generateJson?: (args: { system: string, user: string }) => Promise<object>,
 * }} input
 */
async function markShortAnswerSemantically(input) {
  const studentAnswer = String(input.studentAnswer ?? "").trim();
  if (!studentAnswer) {
    return {
      status: "error",
      code: "EMPTY_ANSWER",
      message: "studentAnswer is required",
    };
  }

  if (!isBlock28SemanticMarkingEnabled(deriveLessonSpecKey(input.lesson))) {
    return {
      status: "unavailable",
      code: "MARKING_UNAVAILABLE",
      message: MARKING_UNAVAILABLE_MESSAGE,
    };
  }

  let resolved;
  try {
    resolved = await resolvePracticeQuestionForMarking({
      lesson: input.lesson,
      questionId: input.questionId,
      attachmentRefId: input.attachmentRefId,
    });
  } catch (err) {
    if (err.code === "QUESTION_NOT_ELIGIBLE") {
      return { status: "error", code: err.code, message: err.message };
    }
    throw err;
  }

  const generateJson = input.generateJson || callSemanticMarkingLlm;
  const baseUserPrompt = buildMarkingUserPrompt({
    effectiveQuestion: resolved.effectiveQuestion,
    effectiveMarks: resolved.effectiveMarks,
    effectiveMarkScheme: resolved.effectiveMarkScheme,
    studentAnswer,
    subject: resolved.subject,
    board: resolved.board,
    level: resolved.level,
    topic: resolved.topic || resolved.topicKey,
  });

  const started = Date.now();
  let structuralRetryCount = 0;
  let lastErrors = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const userPrompt =
      attempt === 0 ? baseUserPrompt : buildCorrectiveUserPrompt(baseUserPrompt, lastErrors);

    let raw;
    try {
      raw = await generateJson({ system: MARKING_SYSTEM_PROMPT, user: userPrompt });
    } catch (err) {
      return {
        status: "unavailable",
        code: "MARKING_UNAVAILABLE",
        message: MARKING_UNAVAILABLE_MESSAGE,
        _debug: { reason: err.code || err.message },
      };
    }

    const validation = validateSemanticLlmPoints(raw, {
      markScheme: resolved.effectiveMarkScheme,
      studentAnswer,
    });

    if (validation.ok) {
      const derived = deriveMarkingResult(
        validation.points,
        resolved.effectiveMarkScheme,
        resolved.effectiveMarks
      );
      return {
        status: "ok",
        ...derived,
        rubricFingerprint: rubricFingerprint(
          resolved.effectiveMarkScheme,
          resolved.effectiveQuestion,
          resolved.effectiveMarks
        ),
        markingEngine: "semantic_v1",
        _meta: {
          latencyMs: Date.now() - started,
          structuralRetryCount,
          provider: process.env.LLM_PROVIDER || "openai",
          model: process.env.BLOCK28_SEMANTIC_MARKING_MODEL || process.env.LLM_MODEL || "gpt-4o-mini",
        },
      };
    }

    lastErrors = validation.errors;
    structuralRetryCount += 1;
  }

  return {
    status: "unavailable",
    code: "MARKING_UNAVAILABLE",
    message: MARKING_UNAVAILABLE_MESSAGE,
    _meta: { structuralRetryCount, validationErrors: lastErrors },
  };
}

module.exports = {
  markShortAnswerSemantically,
  rubricFingerprint,
  deriveLessonSpecKey,
};
