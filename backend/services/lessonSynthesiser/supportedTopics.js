"use strict";

/**
 * P1 allowlist — only route topics with shipped Synthesiser curriculum packs.
 * Teacher taxonomy → Synthesiser identity is resolved in topicIdentityAdapter.js.
 */

const { boardSubjectToSpecKey } = require("../syllabusAlignment");
const { parseTopicKey } = require("../../utils/topicKey");
const {
  TIER_MODE,
  mapTeacherIdentityToSynthesiserIdentity,
  listP1SupportedTopicIdentities,
  findBridgeBySynthesiserIdentity,
} = require("./topicIdentityAdapter");

/** @deprecated use listP1SupportedTopicIdentities — kept for tests importing P1_SUPPORTED_TOPICS */
const P1_SUPPORTED_TOPICS = Object.freeze(
  listP1SupportedTopicIdentities().map((t) =>
    Object.freeze({
      id: `${t.specKey}:${t.topicKey}`,
      specKey: t.specKey,
      topicKey: t.topicKey,
      teacherTopicKey: t.teacherTopicKey,
      subject: "Biology",
      level: "IGCSE",
      examBoard: "Edexcel",
      tierMode: t.tierMode,
      displayTopic: t.displayTopic,
    })
  )
);

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

/**
 * @returns {{ ok: true, entry, synthesiseInput, teacherTopicKey } | { ok: false, code, message }}
 */
function mapTeacherBodyToSynthesiseInput(body) {
  const subject = String(body?.subject || "").trim();
  const level = String(body?.level || "").trim();
  const examBoard = String(body?.board || "").trim();
  const topic = String(body?.topic || "").trim();
  const specKey = resolveSpecKeyFromTeacherBody(body);

  const identity = mapTeacherIdentityToSynthesiserIdentity({
    specKey,
    topicKey: body?.topicKey,
    canonicalTopicKey: body?.canonicalTopicKey,
  });

  if (!identity.ok) {
    return identity;
  }

  const bridge = identity.bridge;
  const entry = findBridgeBySynthesiserIdentity(
    identity.synthesiserSpecKey,
    identity.synthesiserTopicKey
  );
  if (!entry) {
    return {
      ok: false,
      code: "SYNTHESISER_TOPIC_UNSUPPORTED",
      message: "Internal P1 topic bridge missing for resolved Synthesiser identity.",
    };
  }

  const synthesiseInput = {
    subject: bridge.subject || subject,
    level: bridge.level || level,
    examBoard: bridge.examBoard || examBoard,
    topic: topic || bridge.displayTopic,
    specKey: bridge.synthesiserSpecKey,
    topicKey: bridge.synthesiserTopicKey,
  };

  if (bridge.tierMode === TIER_MODE.TIERED) {
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

  return {
    ok: true,
    entry: {
      id: bridge.id,
      specKey: bridge.synthesiserSpecKey,
      topicKey: bridge.synthesiserTopicKey,
      teacherTopicKey: bridge.teacherTopicKey,
      tierMode: bridge.tierMode,
      displayTopic: bridge.displayTopic,
      subject: bridge.subject,
      level: bridge.level,
      examBoard: bridge.examBoard,
    },
    synthesiseInput,
    teacherTopicKey: bridge.teacherTopicKey,
  };
}

module.exports = {
  TIER_MODE,
  P1_SUPPORTED_TOPICS,
  mapTeacherBodyToSynthesiseInput,
  listP1SupportedTopicIdentities,
  mapTeacherIdentityToSynthesiserIdentity,
};
