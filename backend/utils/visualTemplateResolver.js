/**
 * Resolves curated process-diagram packs from cross-subject registry (taxonomy-aware).
 */

const path = require("path");
const {
  getPackById,
  getPackByLegacyKey,
} = require("../../visual-templates/lib/visualPackRegistry");

const SUPPORTED_INTENTS = new Set([
  "process",
  "process-sequence",
  "process-overview",
  "topic-hero",
]);

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function resolvePack(request = {}) {
  const packId = safeStr(request.packId);
  const topicKey = safeStr(request.topicKey);
  const specKey = safeStr(request.specKey);
  if (packId) return getPackById(packId);
  if (topicKey) {
    return getPackByLegacyKey(topicKey, specKey) || getPackById(topicKey);
  }
  return null;
}

function metaPathForPack(pack) {
  const base = safeStr(pack.publicBasePrefix).replace(/^\/+/, "");
  const seg = safeStr(pack.publicPathSegment);
  return path.join(
    __dirname,
    "../public",
    base,
    ...seg.split("/"),
    "meta.json"
  );
}

/**
 * @param {object} request
 * @param {string} [request.packId]
 * @param {string} [request.topicKey] - legacy visual pack key or packId
 * @param {string} [request.visualIntent]
 */
function resolveVisualForLesson(request = {}) {
  const visualIntent = safeStr(request.visualIntent || request.intent || "process").toLowerCase();
  if (!SUPPORTED_INTENTS.has(visualIntent)) return null;

  const pack = resolvePack(request);
  if (!pack || pack.status !== "active" || pack.templateId !== "lr.process.linear.v1") {
    return null;
  }

  const metaPath = metaPathForPack(pack);
  try {
    const meta = require(metaPath);
    const base = `${pack.publicBasePrefix}/${pack.publicPathSegment}`.replace(/\/+/g, "/");
    const steps = (meta.steps || []).map((s) => ({
      ...s,
      url: s.url || `${base}/${safeStr(s.urlSuffix || s.slug)}`.replace(/\/+/g, "/"),
    }));
    return {
      packId: pack.packId,
      templateId: pack.templateId,
      topicKey: request.topicKey || pack.legacyVisualPackKey,
      visualIntent,
      overview: meta.overview || {
        url: `${base}/overview.svg`,
        caption: pack.overviewCaption,
      },
      steps,
      sequenceSteps: meta.sequenceSteps,
      hotspots: meta.hotspots,
      hasStepImages: Array.isArray(steps) && steps.length > 0,
    };
  } catch {
    return null;
  }
}

/** @deprecated use pack-registry */
function findBinding(topicKey) {
  const pack = resolvePack({ topicKey });
  if (!pack) return null;
  return {
    templateId: pack.templateId,
    publicPathSegment: pack.publicPathSegment,
    topicKeys: pack.topicAliases,
  };
}

module.exports = { resolveVisualForLesson, findBinding, resolvePack };
