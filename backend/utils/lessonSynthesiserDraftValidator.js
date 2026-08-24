"use strict";

/**
 * Validate Lesson Synthesiser draft envelope (PR10-compatible).
 * Fail closed — rejects unsupported types and quality-forbidden content.
 */

const ALLOWED_BLOCK_TYPES = Object.freeze([
  "text",
  "keyIdea",
  "keyWords",
  "examTip",
  "commonMistake",
  "checkpoint",
  "selfCheck",
  "pageQuiz",
  "diagram",
  // V1 Learn interactive teaching activities (no quiz/selfCheck on Learn)
  "dragDropMatch",
  "interactiveSequence",
  "interactiveDiagram",
]);

const BANK_COUNTS = Object.freeze({
  selfCheck: 3,
  checkpoint: 3,
  pageQuiz: 5,
});

const BANNED_STEMS = Object.freeze([
  "Which statement best",
  "Which of the following",
  "What is the correct answer",
  "Select the correct option",
]);

const OPTION_FILLER_RE = /\bOption\s*[1-4]\b/i;
const TEACHER_KEY_RE = /teacher-key\s*:/i;

function containsTeacherKeyMarker(value) {
  if (typeof value === "string") return TEACHER_KEY_RE.test(value);
  if (Array.isArray(value)) return value.some(containsTeacherKeyMarker);
  if (value && typeof value === "object") {
    return Object.values(value).some(containsTeacherKeyMarker);
  }
  return false;
}

function validateProgressiveRevealSequenceBlock(block, path, errors) {
  if (block.presentationMode !== "progressiveReveal") {
    errors.push(
      err(
        "SYNTHESISER_SEQUENCE_MODE_INVALID",
        `${path}.presentationMode`,
        'presentationMode must be "progressiveReveal".'
      )
    );
  }

  if (block.enableTestMe !== false) {
    errors.push(
      err(
        "SYNTHESISER_SEQUENCE_TEST_ME_INVALID",
        `${path}.enableTestMe`,
        "enableTestMe must be false."
      )
    );
  }

  const forbiddenTop = [
    "caption",
    "testQuestion",
    "testExplanation",
    "note",
    "teacherBrief",
    "modelAnswer",
    "expectedResponse",
    "teacherGuidance",
  ];
  for (const key of forbiddenTop) {
    if (
      Object.prototype.hasOwnProperty.call(block, key) &&
      block[key] != null &&
      String(block[key]).trim()
    ) {
      errors.push(
        err(
          "SYNTHESISER_SEQUENCE_FORBIDDEN_FIELD",
          `${path}.${key}`,
          `Forbidden field "${key}".`
        )
      );
    }
  }

  if (block.metadata && String(block.metadata.teacherBrief || "").trim()) {
    errors.push(
      err(
        "SYNTHESISER_SEQUENCE_FORBIDDEN_FIELD",
        `${path}.metadata.teacherBrief`,
        "Forbidden metadata.teacherBrief."
      )
    );
  }

  if (containsTeacherKeyMarker(block)) {
    errors.push(
      err(
        "SYNTHESISER_SEQUENCE_FORBIDDEN_FIELD",
        path,
        "teacher-key marker is forbidden."
      )
    );
  }

  const steps = Array.isArray(block.sequenceSteps) ? block.sequenceSteps : [];
  if (steps.length < 1 || steps.length > 8) {
    errors.push(
      err(
        "SYNTHESISER_SEQUENCE_STEP_COUNT",
        `${path}.sequenceSteps`,
        "sequenceSteps must have between 1 and 8 items."
      )
    );
  }

  const seenIds = new Set();
  const seenDescriptions = new Set();
  const forbiddenStep = [
    "caption",
    "testQuestion",
    "testExplanation",
    "modelAnswer",
    "expectedResponse",
    "teacherGuidance",
  ];

  steps.forEach((step, si) => {
    const stepPath = `${path}.sequenceSteps[${si}]`;
    const sid = String(step?.id ?? "").trim();
    if (!sid) {
      errors.push(
        err("SYNTHESISER_SEQUENCE_STEP_ID", `${stepPath}.id`, "Step id is required.")
      );
    } else if (seenIds.has(sid)) {
      errors.push(
        err(
          "SYNTHESISER_SEQUENCE_STEP_ID_DUPLICATE",
          `${stepPath}.id`,
          "Step ids must be unique."
        )
      );
    } else {
      seenIds.add(sid);
    }

    if (!String(step?.title ?? "").trim()) {
      errors.push(
        err(
          "SYNTHESISER_SEQUENCE_STEP_TITLE",
          `${stepPath}.title`,
          "Step title is required."
        )
      );
    }

    const description = String(step?.description ?? "").trim();
    if (!description) {
      errors.push(
        err(
          "SYNTHESISER_SEQUENCE_STEP_DESCRIPTION",
          `${stepPath}.description`,
          "Step description is required."
        )
      );
    } else {
      const normalised = description.toLowerCase().replace(/\s+/g, " ");
      if (seenDescriptions.has(normalised)) {
        errors.push(
          err(
            "SYNTHESISER_SEQUENCE_STEP_DUPLICATE",
            stepPath,
            "Duplicate normalised step descriptions are forbidden."
          )
        );
      }
      seenDescriptions.add(normalised);
    }

    for (const key of forbiddenStep) {
      if (step?.[key] != null && String(step[key]).trim()) {
        errors.push(
          err(
            "SYNTHESISER_SEQUENCE_FORBIDDEN_FIELD",
            `${stepPath}.${key}`,
            `Forbidden field "${key}".`
          )
        );
      }
    }

    if (Array.isArray(step?.sourceIds)) {
      step.sourceIds.forEach((id, ii) => {
        if (typeof id !== "string" || !id.trim()) {
          errors.push(
            err(
              "SYNTHESISER_SEQUENCE_SOURCE_ID",
              `${stepPath}.sourceIds[${ii}]`,
              "sourceIds must be non-empty strings."
            )
          );
        }
      });
    }

    if (containsTeacherKeyMarker(step)) {
      errors.push(
        err(
          "SYNTHESISER_SEQUENCE_FORBIDDEN_FIELD",
          stepPath,
          "teacher-key marker is forbidden."
        )
      );
    }
  });

  if (Array.isArray(block.sourceIds)) {
    block.sourceIds.forEach((id, ii) => {
      if (typeof id !== "string" || !id.trim()) {
        errors.push(
          err(
            "SYNTHESISER_SEQUENCE_SOURCE_ID",
            `${path}.sourceIds[${ii}]`,
            "sourceIds must be non-empty strings."
          )
        );
      }
    });
  }
}

function okResult() {
  return { ok: true, errors: [] };
}

function err(code, path, message) {
  return { code, path, message };
}

function allBlocks(draft) {
  const out = [];
  const pages = Array.isArray(draft?.pages) ? draft.pages : [];
  pages.forEach((page, pi) => {
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    blocks.forEach((block, bi) => {
      out.push({
        block,
        path: `draft.pages[${pi}].blocks[${bi}]`,
      });
    });
  });
  return out;
}

function collectQuestionTexts(q) {
  const texts = [
    q?.stem,
    q?.prompt,
    q?.question,
    q?.answer,
    q?.correctAnswer,
  ];
  if (Array.isArray(q?.options)) {
    for (const opt of q.options) {
      texts.push(typeof opt === "string" ? opt : opt?.text);
    }
  }
  return texts.map((t) => String(t || "")).filter(Boolean);
}

function containsOptionFiller(text) {
  return OPTION_FILLER_RE.test(String(text || ""));
}

function findBannedStem(text) {
  const s = String(text || "");
  for (const banned of BANNED_STEMS) {
    if (s.includes(banned)) return banned;
  }
  return null;
}

function isRetrievalOrActivityDiagram(block) {
  if (block?.type !== "diagram") return false;
  const role = String(block.role || "").toLowerCase();
  const activityType = String(
    block.metadata?.activityType || block.activityType || ""
  ).toLowerCase();
  const kind = String(block.metadata?.kind || block.kind || "").toLowerCase();
  if (role.includes("retrieval") || role.includes("activity")) return true;
  if (kind.includes("retrieval") || kind.includes("activity")) return true;
  if (["retrieval", "activity", "label"].includes(activityType)) return true;
  return false;
}

function labelsAllowedValue(block) {
  if (Object.prototype.hasOwnProperty.call(block, "labelsAllowedOnStudentImage")) {
    return block.labelsAllowedOnStudentImage;
  }
  if (
    block.metadata &&
    Object.prototype.hasOwnProperty.call(block.metadata, "labelsAllowedOnStudentImage")
  ) {
    return block.metadata.labelsAllowedOnStudentImage;
  }
  return undefined;
}

function studentSafeValue(block) {
  if (Object.prototype.hasOwnProperty.call(block, "studentSafe")) {
    return block.studentSafe;
  }
  if (block.metadata && Object.prototype.hasOwnProperty.call(block.metadata, "studentSafe")) {
    return block.metadata.studentSafe;
  }
  return undefined;
}

function validateQuestionBank(block, path, expectedCount, errors) {
  const questions = block?.questions;
  const hasLegacyPrompt =
    String(block?.prompt || block?.question || "").trim().length > 0 ||
    (Array.isArray(block?.options) && block.options.length > 0);

  if (!Array.isArray(questions) || questions.length === 0) {
    if (hasLegacyPrompt) {
      errors.push(
        err(
          "SYNTHESISER_LEGACY_PROMPT_BANK",
          path,
          `${block.type} must use questions[] banks; legacy single-prompt banks are forbidden.`
        )
      );
    } else {
      errors.push(
        err(
          "SYNTHESISER_QUESTION_BANK_INVALID",
          `${path}.questions`,
          `${block.type} questions[] must have length ${expectedCount}.`
        )
      );
    }
    return;
  }

  if (questions.length !== expectedCount) {
    errors.push(
      err(
        "SYNTHESISER_QUESTION_BANK_INVALID",
        `${path}.questions`,
        `${block.type} questions[] must have length ${expectedCount}.`
      )
    );
  }

  questions.forEach((q, qi) => {
    const qPath = `${path}.questions[${qi}]`;
    for (const text of collectQuestionTexts(q)) {
      if (containsOptionFiller(text)) {
        errors.push(
          err(
            "SYNTHESISER_OPTION_FILLER",
            qPath,
            "Option 1–4 filler text is forbidden in question stems/options."
          )
        );
        break;
      }
    }
    const stem = String(q?.stem || q?.prompt || q?.question || "");
    const banned = findBannedStem(stem);
    if (banned) {
      errors.push(
        err(
          "SYNTHESISER_BANNED_STEM",
          qPath,
          `Banned generic stem detected: "${banned}".`
        )
      );
    }
  });
}

function validateTeacherBriefLeak(block, path, errors) {
  if (Object.prototype.hasOwnProperty.call(block, "teacherBrief")) {
    errors.push(
      err(
        "SYNTHESISER_TEACHER_BRIEF_LEAK",
        `${path}.teacherBrief`,
        "teacherBrief must not appear as a top-level student-facing field."
      )
    );
  }

  const teacherBrief = String(block?.metadata?.teacherBrief || "").trim();
  const studentFields = [
    ["content", block?.content],
    ["studentPrompt", block?.studentPrompt],
    ["caption", block?.caption],
  ];

  for (const [field, value] of studentFields) {
    const text = String(value || "");
    if (!text) continue;
    if (/teacher\s*brief\s*:/i.test(text) || /teacherBrief/i.test(text)) {
      errors.push(
        err(
          "SYNTHESISER_TEACHER_BRIEF_LEAK",
          `${path}.${field}`,
          `Student-facing field "${field}" must not contain teacherBrief.`
        )
      );
      continue;
    }
    if (
      teacherBrief.length >= 12 &&
      text.toLowerCase().includes(teacherBrief.toLowerCase())
    ) {
      errors.push(
        err(
          "SYNTHESISER_TEACHER_BRIEF_LEAK",
          `${path}.${field}`,
          `Student-facing field "${field}" must not contain teacherBrief text.`
        )
      );
    }
  }
}

/**
 * @param {object} envelope - { source, generator, draft }
 * @returns {{ ok: boolean, errors: Array<{ code: string, path: string, message: string }> }}
 */
function validateLessonSynthesiserDraftEnvelope(envelope) {
  const errors = [];

  if (!envelope || typeof envelope !== "object") {
    return {
      ok: false,
      errors: [
        err(
          "SYNTHESISER_METADATA_INVALID",
          "",
          "Request body must be an object with source, generator, and draft."
        ),
      ],
    };
  }

  if (envelope.source !== "letsrevise-lesson-synthesiser") {
    errors.push(
      err(
        "SYNTHESISER_SOURCE_INVALID",
        "source",
        'source must be "letsrevise-lesson-synthesiser".'
      )
    );
  }

  if (envelope.generator !== "lesson-synthesiser-v1") {
    errors.push(
      err(
        "SYNTHESISER_GENERATOR_INVALID",
        "generator",
        'generator must be "lesson-synthesiser-v1".'
      )
    );
  }

  const draft = envelope.draft;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    errors.push(
      err("SYNTHESISER_METADATA_INVALID", "draft", "draft must be an object.")
    );
    return { ok: false, errors };
  }

  if (draft?.metadata?.generator !== "lesson-synthesiser-v1") {
    errors.push(
      err(
        "SYNTHESISER_METADATA_INVALID",
        "draft.metadata.generator",
        'draft.metadata.generator must be "lesson-synthesiser-v1".'
      )
    );
  }

  if (draft.status !== "draft") {
    errors.push(
      err(
        "SYNTHESISER_DRAFT_NOT_DRAFT",
        "draft.status",
        'draft.status must be "draft".'
      )
    );
  }

  if (draft.isPublished !== false) {
    errors.push(
      err(
        "SYNTHESISER_PUBLISH_FORBIDDEN",
        "draft.isPublished",
        "draft.isPublished must be false."
      )
    );
  }

  const specKey = draft.specKey != null ? String(draft.specKey).trim() : "";
  const topicKey = draft.topicKey != null ? String(draft.topicKey).trim() : "";
  if (!specKey || !topicKey) {
    errors.push(
      err(
        "SYNTHESISER_TAXONOMY_INVALID",
        "draft.specKey|draft.topicKey",
        "draft.specKey and draft.topicKey are required."
      )
    );
  } else if (!topicKey.startsWith(`${specKey}:`)) {
    errors.push(
      err(
        "SYNTHESISER_TAXONOMY_INVALID",
        "draft.topicKey",
        `draft.topicKey must be namespaced as "${specKey}:...".`
      )
    );
  }

  if (!Array.isArray(draft.pages) || draft.pages.length === 0) {
    errors.push(
      err(
        "SYNTHESISER_METADATA_INVALID",
        "draft.pages",
        "draft.pages[] is required and must be non-empty."
      )
    );
  }

  const bankSeen = { selfCheck: 0, checkpoint: 0, pageQuiz: 0 };

  for (const { block, path } of allBlocks(draft)) {
    const type = block?.type;

    if (type === "quiz" || type === "imageActivity" || !ALLOWED_BLOCK_TYPES.includes(type)) {
      errors.push(
        err(
          "SYNTHESISER_BLOCK_TYPE_FORBIDDEN",
          `${path}.type`,
          `Block type "${type}" is forbidden for Lesson Synthesiser drafts.`
        )
      );
      continue;
    }

    validateTeacherBriefLeak(block, path, errors);

    if (type === "interactiveSequence" && block.presentationMode === "progressiveReveal") {
      validateProgressiveRevealSequenceBlock(block, path, errors);
      continue;
    }

    if (type === "selfCheck" || type === "checkpoint" || type === "pageQuiz") {
      bankSeen[type] += 1;
      validateQuestionBank(block, path, BANK_COUNTS[type], errors);
    }

    if (isRetrievalOrActivityDiagram(block)) {
      if (labelsAllowedValue(block) !== false) {
        errors.push(
          err(
            "SYNTHESISER_IMAGE_SAFETY_INVALID",
            `${path}.labelsAllowedOnStudentImage`,
            "Retrieval/activity diagrams require labelsAllowedOnStudentImage === false."
          )
        );
      }
      if (studentSafeValue(block) !== true) {
        errors.push(
          err(
            "SYNTHESISER_IMAGE_SAFETY_INVALID",
            `${path}.studentSafe`,
            "Retrieval/activity diagrams require studentSafe === true."
          )
        );
      }
    }
  }

  for (const [type, count] of Object.entries(BANK_COUNTS)) {
    if (bankSeen[type] === 0) {
      errors.push(
        err(
          "SYNTHESISER_QUESTION_BANK_INVALID",
          `draft.pages.blocks[${type}]`,
          `A ${type} block with questions[] length ${count} is required.`
        )
      );
    }
  }

  // Also scan lesson-level quiz.questions for fillers / banned stems when present.
  if (Array.isArray(draft.quiz?.questions)) {
    draft.quiz.questions.forEach((q, qi) => {
      const qPath = `draft.quiz.questions[${qi}]`;
      for (const text of collectQuestionTexts(q)) {
        if (containsOptionFiller(text)) {
          errors.push(
            err(
              "SYNTHESISER_OPTION_FILLER",
              qPath,
              "Option 1–4 filler text is forbidden in quiz.questions."
            )
          );
          break;
        }
      }
      const banned = findBannedStem(String(q?.stem || q?.prompt || q?.question || ""));
      if (banned) {
        errors.push(
          err(
            "SYNTHESISER_BANNED_STEM",
            qPath,
            `Banned generic stem detected: "${banned}".`
          )
        );
      }
    });
  }

  return errors.length ? { ok: false, errors } : okResult();
}

module.exports = {
  validateLessonSynthesiserDraftEnvelope,
  ALLOWED_BLOCK_TYPES,
  BANK_COUNTS,
  BANNED_STEMS,
};
