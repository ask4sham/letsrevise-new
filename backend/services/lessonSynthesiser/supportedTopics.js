"use strict";

/**
 * P1 allowlist — only route topics with shipped Synthesiser curriculum packs.
 * Do not claim production parity for unlisted topics.
 */

const { boardSubjectToSpecKey } = require("../syllabusAlignment");
const { parseTopicKey } = require("../../utils/topicKey");

const TIER_MODE = Object.freeze({
  TIERED: "TIERED",
  UNTIERED: "UNTIERED",
});

const P1_SUPPORTED_TOPICS = Object.freeze([
  Object.freeze({
    id: "edexcel-igcse-biology:reproduction/gametes-fertilisation",
    specKey: "edexcel-igcse-biology",
    topicKey: "reproduction/gametes-fertilisation",
    subject: "Biology",
    level: "IGCSE",
    examBoard: "Edexcel",
    tierMode: TIER_MODE.UNTIERED,
    displayTopic: "Gametes and Fertilisation",
  }),
]);

function normalizeSpecKey(specKey) {
  return String(specKey || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function stripTopicKeyNamespace(topicKey, specKey) {
  const raw = String(topicKey || "").trim();
  if (!raw) return "";
  const normalizedSpec = normalizeSpecKey(specKey);
  const colonIdx = raw.indexOf(":");
  if (colonIdx > 0) {
    const prefix = normalizeSpecKey(raw.slice(0, colonIdx));
    if (prefix === normalizedSpec) {
      return raw.slice(colonIdx + 1).trim();
    }
    return raw.slice(colonIdx + 1).trim();
  }
  return raw;
}

function resolveSpecKeyFromTeacherBody(body) {
  const direct =
    typeof body?.specKey === "string" && body.specKey.trim()
      ? body.specKey.trim()
      : "";
  if (direct) return direct;
  const fromTopic = parseTopicKey(body?.topicKey || "").specKey;
  if (fromTopic) return fromTopic;
  return (
    boardSubjectToSpecKey(
      String(body?.board || ""),
      String(body?.subject || ""),
      String(body?.level || "")
    ) || ""
  );
}

function findSupportedTopic(specKey, topicKeyBare) {
  const spec = normalizeSpecKey(specKey);
  const topic = String(topicKeyBare || "").trim();
  return P1_SUPPORTED_TOPICS.find(
    (entry) =>
      normalizeSpecKey(entry.specKey) === spec &&
      entry.topicKey === topic
  );
}

/**
 * @returns {{ ok: true, entry, synthesiseInput } | { ok: false, code, message }}
 */
function mapTeacherBodyToSynthesiseInput(body) {
  const subject = String(body?.subject || "").trim();
  const level = String(body?.level || "").trim();
  const examBoard = String(body?.board || "").trim();
  const topic = String(body?.topic || "").trim();
  const specKey = resolveSpecKeyFromTeacherBody(body);
  const topicKeyBare = stripTopicKeyNamespace(body?.topicKey, specKey);

  if (!specKey || !topicKeyBare) {
    return {
      ok: false,
      code: "SYNTHESISER_INPUT_INCOMPLETE",
      message: "specKey and topicKey are required for Lesson Synthesiser generation.",
    };
  }

  const entry = findSupportedTopic(specKey, topicKeyBare);
  if (!entry) {
    return {
      ok: false,
      code: "SYNTHESISER_TOPIC_UNSUPPORTED",
      message:
        `Topic is not supported by Lesson Synthesiser P1 (${specKey} / ${topicKeyBare}). Use legacy AI generator or choose a supported topic.`,
    };
  }

  const synthesiseInput = {
    subject: entry.subject || subject,
    level: entry.level || level,
    examBoard: entry.examBoard || examBoard,
    topic: topic || entry.displayTopic,
    specKey: entry.specKey,
    topicKey: entry.topicKey,
  };

  if (entry.tierMode === TIER_MODE.TIERED) {
    const tierRaw = String(body?.tier || "").trim();
    if (tierRaw) {
      const normalized =
        tierRaw.toLowerCase() === "foundation"
          ? "Foundation"
          : tierRaw.toLowerCase() === "higher"
            ? "Higher"
            : tierRaw;
      synthesiseInput.tier = normalized;
    }
  }

  if (typeof body?.teacherNotes === "string" && body.teacherNotes.trim()) {
    synthesiseInput.teacherNotes = body.teacherNotes.trim();
  }

  return { ok: true, entry, synthesiseInput };
}

module.exports = {
  TIER_MODE,
  P1_SUPPORTED_TOPICS,
  mapTeacherBodyToSynthesiseInput,
  stripTopicKeyNamespace,
  findSupportedTopic,
};
