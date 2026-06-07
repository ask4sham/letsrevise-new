/**
 * Shared block classification for Lesson Generator V3 (architecture / rhythm / spacing).
 */

const TEACH_TYPES = new Set([
  "text",
  "text-concept",
  "keyidea",
  "commonmistake",
  "examtip",
  "worked-example",
  "hook",
  "objectives",
  "prior-knowledge",
]);

const INTERACTION_TYPES = new Set([
  "checkpoint",
  "self-check-question",
  "selfcheck",
  "dragdropmatch",
  "diagram",
  "interactive-diagram",
  "interactivesequence",
  "graph",
  "hotspot",
]);

const ACTIVITY_TYPES = new Set([
  "diagram",
  "interactive-diagram",
  "interactivesequence",
  "dragdropmatch",
  "graph",
  "hotspot",
]);

const FOUNDATION_SLOTS = new Set([
  "objectives",
  "priorKnowledge",
  "definition",
  "whyItMatters",
  "coreModel",
  "keyExamples",
  "examVocabulary",
  "scenario",
  "coreRule",
]);

const ENDGAME_SLOTS = new Set([
  "examTechnique",
  "examPractice",
  "summary",
  "keywords",
  "revisionPractice",
]);

function flattenPagesToBlocks(pages) {
  const blocks = [];
  if (!Array.isArray(pages)) return blocks;
  for (const page of pages) {
    for (const b of page.blocks || []) {
      blocks.push(b);
    }
  }
  return blocks;
}

function normalizeText(t) {
  return String(t || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function blockHaystack(block) {
  return normalizeText(
    [block.title, block.content, block.text, block.question, block.caption].filter(Boolean).join(" ")
  );
}

/**
 * Classify a block into an architecture slot id (best effort).
 * @param {object} block
 */
function classifyBlockToArchitectureSlot(block) {
  const type = String(block.type || "").toLowerCase();
  const role = String(block.role || "").toLowerCase();
  const title = String(block.title || "").toLowerCase();
  const hay = blockHaystack(block);

  if (
    role === "lessonobjectives" ||
    title.includes("objectives") ||
    hay.includes("revision objectives") ||
    hay.includes("lesson objectives")
  ) {
    return "objectives";
  }
  if (role === "priorknowledge" || title.includes("prior knowledge")) return "priorKnowledge";
  if (role === "definition" || title.includes("definition") || hay.includes("definition")) return "definition";
  if (
    role === "whyitmatters" ||
    ((title.includes("why it matters") || hay.includes("why it matters")) &&
      !hay.includes("premium exam tip"))
  ) {
    return "whyItMatters";
  }
  if (role === "coremodel" || title.includes("core model") || hay.includes("core model")) return "coreModel";
  if (role === "keyexamples" || title.includes("key examples") || hay.includes("key examples")) {
    return "keyExamples";
  }
  if (role === "examvocabulary" || title.includes("exam vocabulary") || hay.includes("exam vocabulary")) {
    return "examVocabulary";
  }
  if (role === "hook" || title.includes("scenario") || hay.includes("right, let")) return "scenario";
  if (role === "corerule" || title.includes("core rule") || hay.includes("rule we")) return "coreRule";
  if (role === "examtechnique" || type === "examtip" || title.includes("exam technique")) {
    return "examTechnique";
  }
  if (role === "exampractice" || (type === "text" && title.includes("exam practice"))) {
    return "examPractice";
  }
  if (role === "summary" || title.includes("summary")) return "summary";
  if (role === "keywords" || type === "keywords" || title.includes("key words")) return "keywords";

  if (type === "checkpoint" || role === "checkpoint" || role === "quickcheck") {
    return "checkpoint";
  }
  if (ACTIVITY_TYPES.has(type) || role === "match" || role === "sequence") {
    if (type === "graph") return "visualActivity";
    if (type === "dragdropmatch" || type === "hotspot") return "interactiveActivity";
    return "visualActivity";
  }
  if (role === "commonmistake") return "applicationActivity";
  if (TEACH_TYPES.has(type) && (role === "concept" || role === "coreRule")) {
    return "teachChunk";
  }
  if (TEACH_TYPES.has(type)) return "teachChunk";

  return "unclassified";
}

function isTeachBlock(block) {
  const slot = classifyBlockToArchitectureSlot(block);
  if (FOUNDATION_SLOTS.has(slot)) return false;
  if (ENDGAME_SLOTS.has(slot)) return false;
  if (slot === "checkpoint") return false;
  if (slot === "interactiveActivity" || slot === "visualActivity" || slot === "applicationActivity") {
    return false;
  }
  const type = String(block.type || "").toLowerCase();
  return TEACH_TYPES.has(type) || slot === "teachChunk";
}

function isInteractionBlock(block) {
  const slot = classifyBlockToArchitectureSlot(block);
  if (slot === "checkpoint") return true;
  if (["interactiveActivity", "visualActivity", "applicationActivity"].includes(slot)) return true;
  const type = String(block.type || "").toLowerCase();
  return INTERACTION_TYPES.has(type);
}

function inferConceptFromBlock(block) {
  const hay = blockHaystack(block);
  const concepts = [
    ["atp", "ATP"],
    ["oxygen debt", "oxygen_debt"],
    ["anaerobic", "anaerobic_respiration"],
    ["aerobic", "aerobic_respiration"],
    ["catabolism", "catabolism"],
    ["anabolism", "anabolism"],
    ["metabolism", "metabolism"],
    ["starch", "starch_storage"],
    ["nitrate", "nitrate_ions"],
    ["limiting factor", "limiting_factor"],
    ["graph", "graph_interpretation"],
    ["defence", "defence_types"],
    ["glucose", "respiration"],
  ];
  for (const [needle, id] of concepts) {
    if (hay.includes(needle)) return id;
  }
  return block.conceptId || null;
}

module.exports = {
  TEACH_TYPES,
  INTERACTION_TYPES,
  ACTIVITY_TYPES,
  FOUNDATION_SLOTS,
  ENDGAME_SLOTS,
  flattenPagesToBlocks,
  normalizeText,
  blockHaystack,
  classifyBlockToArchitectureSlot,
  isTeachBlock,
  isInteractionBlock,
  inferConceptFromBlock,
};
