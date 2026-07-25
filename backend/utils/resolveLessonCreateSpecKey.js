/**
 * Resolve specKey for lesson create/update taxonomy finalize.
 *
 * Priority (product contract for Generator import / Create Lesson):
 * 1. Valid explicit body specKey
 * 2. Explicit board + level (+ subject) registry mapping
 * 3. Valid namespaced topicKey prefix
 * 4. Legacy AQA default only when no board/level/spec/topic identity exists
 *
 * Explicit Edexcel identity must never be replaced by aqa-gcse-biology.
 */
"use strict";

const { DEFAULT_SPEC_LEGACY, parseTopicKey } = require("./topicKey");
const {
  boardSubjectToSpecKey,
  getSpecMetadata,
  inferEdexcelIgcseBiologySpecKey,
} = require("../config/specRegistry");

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

/**
 * @param {{
 *   specKey?: string|null,
 *   topicKey?: string|null,
 *   board?: string|null,
 *   subject?: string|null,
 *   level?: string|null,
 *   title?: string|null,
 *   topic?: string|null,
 *   subTopic?: string|null,
 * }} input
 * @returns {string|null} resolved specKey, or null when identity is explicit but unresolvable
 */
function resolveLessonCreateSpecKey(input = {}) {
  const bodySpec = safeStr(input.specKey);
  if (bodySpec && getSpecMetadata(bodySpec)) {
    return bodySpec;
  }

  const fromBoardLevel = boardSubjectToSpecKey(input.board, input.subject, input.level);
  if (fromBoardLevel && getSpecMetadata(fromBoardLevel)) {
    return fromBoardLevel;
  }

  const inferredEdexcel = inferEdexcelIgcseBiologySpecKey({
    board: input.board,
    subject: input.subject,
    level: input.level,
    topicKey: input.topicKey,
    title: input.title,
    topic: input.topic,
    subTopic: input.subTopic,
  });
  if (inferredEdexcel && getSpecMetadata(inferredEdexcel)) {
    return inferredEdexcel;
  }

  const topicKey = safeStr(input.topicKey);
  const parsed = topicKey ? parseTopicKey(topicKey) : { specKey: null, isNamespaced: false };
  if (parsed.isNamespaced && parsed.specKey && getSpecMetadata(parsed.specKey)) {
    return parsed.specKey;
  }

  const board = safeStr(input.board);
  const level = safeStr(input.level);

  // Explicit Edexcel must never fall through to AQA legacy.
  if (/^edexcel$/i.test(board)) {
    if (/igcse/i.test(level) && /^biology$/i.test(safeStr(input.subject))) {
      return getSpecMetadata("edexcel-igcse-biology") ? "edexcel-igcse-biology" : null;
    }
    return null;
  }

  const hasAnyIdentity = Boolean(board || level || bodySpec || (parsed.isNamespaced && parsed.specKey));
  if (!hasAnyIdentity) {
    return DEFAULT_SPEC_LEGACY;
  }

  // Known AQA / empty-board GCSE-style payloads keep legacy default when subject maps.
  if (!board || /^aqa$/i.test(board)) {
    return DEFAULT_SPEC_LEGACY;
  }

  return null;
}

module.exports = {
  resolveLessonCreateSpecKey,
};
