/**
 * Autopilot Prompt Pack Metadata — registry and metadata builder.
 * Used across autopilot generation and run logging. Easy to extend later.
 */

const AutopilotPromptExperiment = require("../models/AutopilotPromptExperiment");

const PROMPT_PACK_REGISTRY = [
  {
    promptPackId: "autopilot-core",
    promptPackVersion: "v1",
    label: "Autopilot Core v1",
    generatorMode: "starter_pack",
    isDefault: true,
    isActive: true,
  },
  {
    promptPackId: "autopilot-core",
    promptPackVersion: "v2",
    label: "Autopilot Core v2",
    generatorMode: "starter_pack",
    isDefault: false,
    isActive: true,
  },
];

/**
 * Get available prompt packs (active only).
 */
function getAvailableAutopilotPromptPacks() {
  return PROMPT_PACK_REGISTRY.filter((p) => p.isActive);
}

/**
 * Get current default prompt pack.
 */
function getCurrentAutopilotPromptPack() {
  const defaultPack = PROMPT_PACK_REGISTRY.find((p) => p.isDefault && p.isActive);
  if (defaultPack) {
    return {
      promptPackId: defaultPack.promptPackId,
      promptPackVersion: defaultPack.promptPackVersion,
      label: defaultPack.label,
      generatorMode: defaultPack.generatorMode,
    };
  }
  const first = PROMPT_PACK_REGISTRY.find((p) => p.isActive);
  return first
    ? { promptPackId: first.promptPackId, promptPackVersion: first.promptPackVersion, label: first.label, generatorMode: first.generatorMode }
    : { promptPackId: "autopilot-core", promptPackVersion: "v1", label: "Autopilot Core v1", generatorMode: "starter_pack" };
}

/**
 * Resolve prompt pack by id and optional version.
 * Falls back safely: if version missing, returns first active pack with that id.
 * @returns { pack, error } — pack is null if invalid.
 */
function getAutopilotPromptPackById(promptPackId, promptPackVersion) {
  if (!promptPackId || typeof promptPackId !== "string") {
    return { pack: null, error: "promptPackId required" };
  }
  const id = String(promptPackId).trim();
  const active = PROMPT_PACK_REGISTRY.filter((p) => p.isActive && p.promptPackId === id);
  if (active.length === 0) {
    return { pack: null, error: `Unknown prompt pack: ${id}` };
  }
  if (promptPackVersion) {
    const version = String(promptPackVersion).trim();
    const match = active.find((p) => p.promptPackVersion === version);
    if (!match) {
      return { pack: null, error: `Unknown prompt pack version: ${id}@${version}` };
    }
    return { pack: match, error: null };
  }
  return { pack: active[0], error: null };
}

/**
 * Build prompt metadata for autopilot-generated content.
 * @param {{ contentType, specKey, topicKey, generatorMode?, promptPack? }}
 * If promptPack provided, uses it; otherwise uses current default.
 */
function buildAutopilotPromptMetadata({ contentType, specKey, topicKey, generatorMode, promptPack }) {
  const pack = promptPack || getCurrentAutopilotPromptPack();
  const packId = pack?.promptPackId ?? "autopilot-core";
  const packVersion = pack?.promptPackVersion ?? "v1";
  const mode = generatorMode ?? pack?.generatorMode ?? "starter_pack";
  const meta = {
    promptPackId: packId,
    promptPackVersion: packVersion,
    contentType: contentType || null,
    generatorMode: mode,
    generatedBy: "autopilot",
    specKey: specKey || null,
    topicKey: topicKey || null,
    generatedAt: new Date(),
  };
  if (promptPack?.sourceType) meta.sourceType = promptPack.sourceType;
  return meta;
}

/**
 * Match experiment to run context. Experiment applies if spec/topic match.
 * specKey/topicKey null = applies to all.
 */
function experimentMatches(exp, specKey, topicKey) {
  if (exp.specKey && exp.specKey !== specKey) return false;
  if (exp.topicKey) {
    const topicOnly = (topicKey || "").split(":").pop() || topicKey;
    const fullTopic = (topicKey || "").includes(":") ? topicKey : specKey ? `${specKey}:${topicOnly}` : topicOnly;
    if (exp.topicKey !== fullTopic && exp.topicKey !== topicOnly && !(fullTopic || "").endsWith(":" + exp.topicKey)) return false;
  }
  return true;
}

/**
 * Resolve prompt pack for a run: explicit selection > experiment assignment > default.
 * @param {{ specKey, topicKey, requestedPack? }}
 * @param requestedPack { promptPackId, promptPackVersion } when admin explicitly selects
 * @returns { Promise<{ pack, experimentId? }> }
 */
async function resolvePromptPackForRun({ specKey, topicKey, requestedPack }) {
  if (requestedPack?.promptPackId) {
    const { pack, error } = getAutopilotPromptPackById(requestedPack.promptPackId, requestedPack.promptPackVersion);
    if (error) return { pack: null, error, experimentId: null };
    return {
      pack: { promptPackId: pack.promptPackId, promptPackVersion: pack.promptPackVersion, generatorMode: pack.generatorMode },
      experimentId: null,
    };
  }

  const topicFull = (topicKey || "").includes(":") ? topicKey : specKey ? `${specKey}:${(topicKey || "").trim()}` : topicKey;
  const experiments = await AutopilotPromptExperiment.find({ status: "active" })
    .sort({ topicKey: -1, specKey: -1 })
    .lean();

  const matching = experiments.filter((e) => experimentMatches(e, specKey, topicFull));
  if (matching.length === 0) {
    const defaultPack = getCurrentAutopilotPromptPack();
    return {
      pack: { promptPackId: defaultPack.promptPackId, promptPackVersion: defaultPack.promptPackVersion, generatorMode: defaultPack.generatorMode },
      experimentId: null,
    };
  }

  const experiment = matching[0];
  const packs = experiment.promptPacks || [];
  if (packs.length === 0) {
    const defaultPack = getCurrentAutopilotPromptPack();
    return { pack: { promptPackId: defaultPack.promptPackId, promptPackVersion: defaultPack.promptPackVersion, generatorMode: defaultPack.generatorMode }, experimentId: experiment.experimentId };
  }

  let selected;
  if (experiment.assignmentMode === "weighted_random") {
    const totalWeight = packs.reduce((s, p) => s + (p.weight || 1), 0);
    let r = Math.random() * totalWeight;
    for (const p of packs) {
      r -= p.weight || 1;
      if (r <= 0) {
        selected = p;
        break;
      }
    }
    selected = selected || packs[packs.length - 1];
  } else {
    const updated = await AutopilotPromptExperiment.findByIdAndUpdate(experiment._id, { $inc: { _roundRobinIndex: 1 } }, { new: true })
      .select("+_roundRobinIndex")
      .lean();
    const idx = ((updated && updated._roundRobinIndex) || 0) % packs.length;
    selected = packs[idx];
  }

  const { pack, error } = getAutopilotPromptPackById(selected.promptPackId, selected.promptPackVersion);
  if (error) {
    const defaultPack = getCurrentAutopilotPromptPack();
    return { pack: { promptPackId: defaultPack.promptPackId, promptPackVersion: defaultPack.promptPackVersion, generatorMode: defaultPack.generatorMode }, experimentId: experiment.experimentId };
  }
  return {
    pack: { promptPackId: pack.promptPackId, promptPackVersion: pack.promptPackVersion, generatorMode: pack.generatorMode },
    experimentId: experiment.experimentId,
  };
}

module.exports = {
  getAvailableAutopilotPromptPacks,
  getCurrentAutopilotPromptPack,
  getAutopilotPromptPackById,
  buildAutopilotPromptMetadata,
  resolvePromptPackForRun,
  PROMPT_PACK_REGISTRY,
};
